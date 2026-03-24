import { useMemo } from 'react';

/**
 * Custom hook to calculate all statistics related to schedules.
 * @param {Array} rawData - The raw uncompressed schedule data from the database.
 * @param {Array} activeData - The filtered data currently active in the system (excluding disabled weeks).
 * @param {Array} targetData - The current filtered viewpoint data (e.g., specific class or teacher).
 * @param {Array} disabledWeeks - Array of week identifiers that are currently hidden.
 * @param {string} selectedClass - Currently selected class name.
 * @param {string} selectedTeacher - Currently selected teacher name.
 * @param {function} isFutureWeek - Utility function to check if a lesson date is in the future.
 * @param {function} isCurrentWeek - Utility function to check if a lesson date is in the current week.
 * @param {function} isTeacherPending - Utility function to check if a teacher slot is 'A Definir'.
 * @returns {Object} { dbSummary, adminStats, alunoStats, profStats, diarioStats }
 */
export function useScheduleStats({
  rawData,
  activeData,
  targetData,
  finalFilteredTotalData,
  disciplinesMeta,
  subjectHoursMeta,
  disabledWeeks,
  selectedClass,
  selectedTeacher,
  isFutureWeek,
  isCurrentWeek,
  isDatePastOrToday,
  isTeacherPending
}) {

  // ==========================================
  // DB & ADMIN STATS
  // ==========================================
  const dbSummary = useMemo(() => {
    const summary = {};
    rawData.forEach(r => { 
      const key = `${r.week}-${r.type}`;
      if(!summary[key]) {
        summary[key] = { 
          key: key,
          week: r.week,
          type: r.type, 
          fileName: r.fileName || 'Arquivo Desconhecido',
          count: 0, 
          isActive: !disabledWeeks.includes(key),
          updatedAt: r.updatedAt || null
        }; 
      }
      summary[key].count++; 
      if (r.updatedAt && (!summary[key].updatedAt || new Date(r.updatedAt) > new Date(summary[key].updatedAt))) {
        summary[key].updatedAt = r.updatedAt;
      }
    });
    const getVal = (s) => { 
      if (!s || typeof s !== 'string') return 9999;
      const m = s.match(/(\d{2})\/(\d{2})/); 
      return m ? parseInt(m[2])*100 + parseInt(m[1]) : 9999; 
    };
    return Object.values(summary).sort((a,b) => getVal(a.week) - getVal(b.week));
  }, [rawData, disabledWeeks]);

  const adminStats = useMemo(() => {
    const oficial = rawData.filter(r => r.type === 'oficial');
    const previa = rawData.filter(r => r.type === 'previa');
    const padrao = rawData.filter(r => r.type === 'padrao');

    return {
      oficial: { weeks: new Set(oficial.map(r => r.week)).size, classes: oficial.length },
      previa: { weeks: new Set(previa.map(r => r.week)).size, classes: previa.length },
      padrao: { weeks: new Set(padrao.map(r => r.week)).size, classes: padrao.length }
    };
  }, [rawData]);

  // ==========================================
  // VIEW-SPECIFIC STATS (Aluno & Professor)
  // ==========================================
  const alunoStats = useMemo(() => {
    if (!selectedClass) return { lecionadas: 0, semProfessorSemana: 0, aReporTotal: 0 };

    const getWeekEndDate = (weekStr) => {
        if (!weekStr) return null;
        const m = weekStr.match(/a\s*(\d{2})[\/\-](\d{2})/i);
        if (!m) return null;
        const year = new Date().getFullYear();
        // O final da semana (end_date real).
        return new Date(year, parseInt(m[2])-1, parseInt(m[1]), 23, 59, 59);
    };

    const isRecordPast = (r) => {
        if (r.date) return !isFutureWeek(r.date, r.year); 
        const end = getWeekEndDate(r.week);
        if (!end) return false; // Se a semana não tiver data válida, por segurança não assumimos que já passou.
        return end <= new Date(); // Se passou a data final da semana, conta como dada.
    };
    
    const classDataOficialAll = activeData.filter(r => r.className === selectedClass && r.type === 'oficial');
    const lecionadas = classDataOficialAll.filter(r => isRecordPast(r)).length;
    const aReporTotal = classDataOficialAll.filter(r => isRecordPast(r) && isTeacherPending(r.teacher)).length;
    
    // semProfessorSemana uses targetData (which logically wraps around selectedWeek filter context now)
    const viewData = targetData.filter(r => r.className === selectedClass);
    const semProfessorSemana = viewData.filter(r => isTeacherPending(r.teacher)).length;
    
    return { lecionadas, semProfessorSemana, aReporTotal };
  }, [activeData, targetData, selectedClass, isFutureWeek, isTeacherPending]);

  const profStats = useMemo(() => {
    if (!selectedTeacher) return { dadas: 0, turmas: 0, semanaAtual: 0 };
    const extraTypes = ['Recuperação', 'Exame Final', 'Atendimento ao aluno', 'Lançamento Extra'];
    const profData = activeData.filter(r => r.teacher === selectedTeacher && r.type === 'oficial' && !extraTypes.includes(r.classType));
    const dadas = profData.filter(r => !isFutureWeek(r.date, r.year)).length;
    const turmas = new Set(profData.map(r => r.className)).size;
    const semanaAtual = profData.filter(r => isCurrentWeek(r.date, r.year)).length;
    return { dadas, turmas, semanaAtual };
  }, [activeData, selectedTeacher, isFutureWeek, isCurrentWeek]);

  // ==========================================
  // DIARY STATS (Teacher Diary View)
  // ==========================================
  const diarioStats = useMemo(() => {
    let ministradas = 0;
    const uniqueDisciplines = new Set();
    const suapMap = {};
    const totalHoursMap = {};
    const extraTypes = ['Recuperação', 'Exame Final', 'Atendimento ao aluno', 'Lançamento Extra'];

    finalFilteredTotalData.forEach(r => {
      // Ignorar classes contadas como carga horária extra ou não dedutível da matriz original
      if (extraTypes.includes(r.classType)) return;

      // Conta todas as aulas que já aconteceram para a query atual
      if (isDatePastOrToday(r.date, r.year)) {
        ministradas += 1;
      }

      // Agrupamento para somar as metas sem duplicidade
      const serieMatch = r.className.match(/^\d+/);
      const serie = serieMatch ? serieMatch[0] : 'Outras';
      const discId = `${r.course}|${r.className}|${r.subject}`;
      const subjId = `${serie}|${r.subject}`;

      if (!uniqueDisciplines.has(discId)) {
        uniqueDisciplines.add(discId);
        
        // Pega os metadados do BD caso o usuário tenha editado manuais no admin panel
        const metaDisc = disciplinesMeta[discId] || { suapHours: null };
        const metaSubj = subjectHoursMeta[subjId] || { totalHours: null };
        
        // Caso os metadados não existam, usa a carga horária embutida extraída automaticamente da matriz (backend JSON injection)
        suapMap[discId] = metaDisc.suapHours !== null ? (parseInt(metaDisc.suapHours) || 0) : (r.suapHours || 0);
        totalHoursMap[discId] = metaSubj.totalHours !== null ? (parseInt(metaSubj.totalHours) || 0) : (r.totalHours || 0);
      }
    });

    let suapTotal = 0;
    let chTotal = 0;

    Object.values(suapMap).forEach(v => suapTotal += v);
    Object.values(totalHoursMap).forEach(v => chTotal += v);

    const restantes = chTotal - ministradas;
    const aLancar = ministradas - suapTotal;

    // Cálculo de Andamento (Adiantada / Atrasada / Em Dia)
    // 1. Quantas semanas oficiais já tiveram pelo menos 1 dia transcorrido?
    const pastOfficialRecords = activeData.filter(r => r.type === 'oficial' && isDatePastOrToday(r.date, r.year));
    const passedWeeks = new Set(pastOfficialRecords.map(r => r.week)).size;
    
    // 2. Qual a expectativa de aulas até agora (distribuição linear em 40 semanas)?
    const expected = (chTotal / 40) * passedWeeks;
    const diff = ministradas - expected;
    const tolerance = expected * 0.10;
    
    let status = 'indefinido';
    let diffAbs = Math.round(Math.abs(diff));

    if (chTotal > 0) {
      if (diff < -tolerance) status = 'atrasada';
      else if (diff > tolerance) status = 'adiantada';
      else status = 'em_dia';
    }

    return {
      chTotal,
      ministradas,
      suapTotal,
      restantes,
      aLancar,
      status,
      diffAbs
    };
  }, [finalFilteredTotalData, disciplinesMeta, subjectHoursMeta, activeData, isDatePastOrToday]);

  return {
    dbSummary,
    adminStats,
    alunoStats,
    profStats,
    diarioStats
  };
}
