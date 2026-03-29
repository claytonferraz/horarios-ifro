// ==========================================
// MOTOR DE REGRAS DE COLISÃO DE HORÁRIOS
// Abordagem V1 - Avaliação Parametrizada
// ==========================================

/**
 * Interface de 'Rule'
 * {
 *   code_name: string,
 *   title: string,
 *   severity: 'MANDATORY' | 'WARNING' | 'MANDATORY_WITH_EXCEPTION',
 *   is_active: boolean,
 *   exceptions: object
 * }
 */

// Utilidade para converter "segunda", "terca"... para index
const diasDaSemana = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

function getDayIndex(dayStr) {
    return diasDaSemana.indexOf(dayStr.toLowerCase());
}

// Analisa tempo (ex: "19:00 - 19:50") em um objeto simples se necessário, mas em geral,
// os blocos de horário no DAPE são sequenciais num array padronizado.

const TURNOS = {
    MATUTINO: 'Matutino',
    VESPERTINO: 'Vespertino',
    NOTURNO: 'Noturno'
};

// Determina o turno baseado no texto do horário ou numa tabela estática
function determineTurno(timeStr) {
    const startHour = parseInt(timeStr.split(':')[0], 10);
    if (startHour >= 7 && startHour < 13) return TURNOS.MATUTINO;
    if (startHour >= 13 && startHour < 18) return TURNOS.VESPERTINO;
    if (startHour >= 18) return TURNOS.NOTURNO;
    return 'Desconhecido';
}

function processExceptions(rule, teacherId, weekId, academicYear) {
    try {
        const exs = typeof rule.exceptions === 'string' ? JSON.parse(rule.exceptions) : rule.exceptions;
        if (!exs) return false;
        
        // Se a regra for de outro ano letivo, ela não se aplica (opcional, dependendo de como salvamos)
        // Por enquanto, as regras são globais mas contextuais à tela aberta.

        const isTeacherIgnored = exs.ignoredTeachers && teacherId && exs.ignoredTeachers.includes(teacherId);
        const isWeekIgnored = exs.ignoredWeeks && weekId && exs.ignoredWeeks.includes(weekId);

        // Lógica de Isenção: Se o professor está na lista OU a semana está na lista, a regra é relaxada.
        if (isTeacherIgnored || isWeekIgnored) return true;

        return false;
    } catch {
        return false;
    }
}


/**
 * Executa as validações para a mudança de uma aula.
 * 
 * @param {Array} rawSchedules - Grade completa de todas as turmas
 * @param {Object} proposedDrop - Movimento proposto { teacher, subject, targetDay, targetTime, sourceDay, sourceTime, currentClass (turma) }
 * @param {Array} activeRules - Array de regras retornadas pelo banco (useScheduleRules)
 * @param {Object} context - { academicWeekId } usado para gerenciar obrigatoriedade com exceção
 * @returns {Array} - Array de warnings/erros (status 'warning' ou 'error')
 */
export function validateMove(rawSchedules, proposedDrop, activeRules, context = {}) {
    const logs = [];

    // Ignora aulas vazias ou sem professor
    if (!proposedDrop.teacher || proposedDrop.teacher === 'A Definir' || proposedDrop.teacher === 'Vago') {
        return logs;
    }

    const teacher = proposedDrop.teacher;
    const rulesMap = new Map();
    activeRules.forEach(r => rulesMap.set(r.code_name, r));

    // Array contendo outras aulas deste mesmo professor, fingindo que o proposedDrop já ocorreu (removendo a original)
    let teacherSchedule = rawSchedules.filter(r => r.teacher === teacher);

    // Se é um Mover (swap ou arrastar), remove aula antiga (para não auto-colidir)
    if (proposedDrop.sourceDay && proposedDrop.sourceTime) {
        teacherSchedule = teacherSchedule.filter(r => !(r.day === proposedDrop.sourceDay && r.time === proposedDrop.sourceTime && r.className === proposedDrop.currentClass));
    }

    // Cria simulação com a aula incluída (se ela não estiver dropando no Vazio/Lixo)
    const simulatedAula = {
        day: proposedDrop.targetDay,
        time: proposedDrop.targetTime,
        className: proposedDrop.currentClass,
        teacher: teacher,
        subject: proposedDrop.subject
    };
    teacherSchedule.push(simulatedAula);

    // Helpers function para criar um issue padronizado
    const emitIssue = (rule, msgDetails) => {
        // Se a regra tem exceções ativas, abaixa severidade ou ignora
        let isExceptional = processExceptions(rule, teacher, context.academicWeekId, context.academicYear);

        let finalType = rule.severity === 'MANDATORY' ? 'error' : 'warning';
        let desc = isExceptional ? `(EXCEÇÃO APLICADA) ${msgDetails}` : msgDetails;

        if (isExceptional && rule.severity !== 'WARNING') {
            finalType = 'warning'; // Cai a gravidade para aviso se houver exceção
        } else if (rule.severity === 'MANDATORY_WITH_EXCEPTION') {
            finalType = 'error'; // Bloqueia se não for exceção
        }

        logs.push({
            ruleId: rule.code_name,
            title: rule.title,
            type: finalType,
            message: desc,
            isExceptional
        });
    };

    // -----------------------------------------------------
    // REGULAMENTO 1: Não pode ter aulas simultâneas em turmas diferentes (Intersecção de Slot)
    // -----------------------------------------------------
    const ruleSimultaneous = rulesMap.get('no_simultaneous_classes');
    if (ruleSimultaneous?.is_active) {
        const sameSlot = teacherSchedule.filter(r => r.day === simulatedAula.day && r.time === simulatedAula.time);
        if (sameSlot.length > 1) {
            emitIssue(ruleSimultaneous, `O professor já possui aula alocada neste mesmo dia e horário na turma ${sameSlot[0].className === simulatedAula.className ? sameSlot[1].className : sameSlot[0].className}.`);
        }
    }

    // -----------------------------------------------------
    // REGULAMENTO 2: Três turnos no mesmo dia
    // -----------------------------------------------------
    const ruleTriple = rulesMap.get('no_triple_shift');
    if (ruleTriple?.is_active) {
        const classesInDay = teacherSchedule.filter(r => r.day === simulatedAula.day);
        const shiftsInDay = new Set();
        classesInDay.forEach(r => shiftsInDay.add(determineTurno(r.time)));

        if (shiftsInDay.size >= 3) {
            emitIssue(ruleTriple, `A alocação cria lecionamento em 3 turnos (Manhã, Tarde e Noite) no mesmo dia (${simulatedAula.day}).`);
        }
    }

    // -----------------------------------------------------
    // REGULAMENTO 3: Interjornada Noturno/Matutino
    // -----------------------------------------------------
    const ruleNightMorning = rulesMap.get('no_night_morning_clash');
    if (ruleNightMorning?.is_active) {
        const dayIdx = getDayIndex(simulatedAula.day);
        
        // Verifica se essa inserção afeta a relação Hoje-Amanhã
        // a) Se colocou a aula de Manhã num botão e quer verificar o dia de ONTEM da noite
        if (determineTurno(simulatedAula.time) === TURNOS.MATUTINO && dayIdx > 0) {
             const prevDayStr = diasDaSemana[dayIdx - 1];
             const prevNightClasses = teacherSchedule.filter(r => r.day === prevDayStr && determineTurno(r.time) === TURNOS.NOTURNO);
             // Regra dura: Se teve alguma a noite, não pode as 2 primeiras (neste mock validamos se teve alguma pra emitir alerta)
             if (prevNightClasses.length > 0) {
                 // Simplificando: vamos validar se a aula MATUTINA inserida é do horário 1 ou 2. (assumiremos os dois pimeiros da manha listados)
                 // Poderíamos passar um match regex.
                 emitIssue(ruleNightMorning, `O professor lecionou no período NOTURNO no dia anterior (${prevDayStr}). Evite fechar os primeiros horários na manhã de ${simulatedAula.day}.`);
             }
        }

        // b) Se colocou a aula a Noite num dia e quer verificar o AMANHA
        if (determineTurno(simulatedAula.time) === TURNOS.NOTURNO && dayIdx < 5) { // Até sexta
             const nextDayStr = diasDaSemana[dayIdx + 1];
             const nextMorningClasses = teacherSchedule.filter(r => r.day === nextDayStr && determineTurno(r.time) === TURNOS.MATUTINO);
             if (nextMorningClasses.length > 0) {
                 emitIssue(ruleNightMorning, `O professor irá lecionar no MATUTINO no dia seguinte (${nextDayStr}). Lançar aulas no NOTURNO hoje causa quebra de interjornada.`);
             }
        }
    }

    // -----------------------------------------------------
    // REGULAMENTO 4: Transição entre Turnos Adjacentes (Tarde -> Noite)
    // -----------------------------------------------------
    const ruleTransition = rulesMap.get('no_turn_transition_clash');
    if (ruleTransition?.is_active) {
        // Se colocar tarde, verifique noite
        if (determineTurno(simulatedAula.time) === TURNOS.VESPERTINO) {
            const nightClasses = teacherSchedule.filter(r => r.day === simulatedAula.day && determineTurno(r.time) === TURNOS.NOTURNO);
            if (nightClasses.length > 0) {
                emitIssue(ruleTransition, `Carga colada de final da Tarde e Início da Noite neste dia.`);
            }
        }
        if (determineTurno(simulatedAula.time) === TURNOS.NOTURNO) {
            const afternoonClasses = teacherSchedule.filter(r => r.day === simulatedAula.day && determineTurno(r.time) === TURNOS.VESPERTINO);
            if (afternoonClasses.length > 0) {
                emitIssue(ruleTransition, `Carga transiente sem intervalo adequado entre Vespertino e Noturno.`);
            }
        }
    }

    // -----------------------------------------------------
    // REGULAMENTO 5: Conflito de Espaço/Sala (V1)
    // -----------------------------------------------------
    const ruleRoom = rulesMap.get('no_room_overlap');
    if (ruleRoom?.is_active && proposedDrop.room) {
        const roomClash = rawSchedules.find(r => 
            r.day === simulatedAula.day && 
            r.time === simulatedAula.time && 
            r.className !== simulatedAula.className &&
            r.room === proposedDrop.room
        );
        if (roomClash) {
            emitIssue(ruleRoom, `O espaço "${proposedDrop.room}" já está sendo usado pela turma "${roomClash.className}".`);
        }
    }

    return logs;
}
