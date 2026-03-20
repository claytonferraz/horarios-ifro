import React, { useState, useEffect, useMemo } from 'react';
import { CalendarDays, GripVertical, AlertCircle, Save, Filter, MapPin, Loader2, Download, X, Check, Layers, Trash2, Eye, EyeOff, Target, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { MAP_DAYS, getColorHash, resolveTeacherName } from '@/lib/dates';
import { apiClient, getHeaders } from '@/lib/apiClient';

export function MasterGrid({ isDarkMode, ...props }) {
  const { globalTeachers: globalTeachersList, activeDays, classTimes, academicWeeks, selectedConfigYear, setSelectedConfigYear, academicYearsMeta } = useData();
  
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [isCoursesOpen, setIsCoursesOpen] = useState(false);
  const [hiddenClasses, setHiddenClasses] = useState([]);
 
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneSourceYear, setCloneSourceYear] = useState('');

  const [aulasNeutras, setAulasNeutras] = useState([]);
  const [grade, setGrade] = useState({});
  
  // ESTADO DA TELA PRINCIPAL (O que o usuário está visualizando)
  const [selectedType, setSelectedType] = useState('previa'); 
  const [selectedWeek, setSelectedWeek] = useState('');
  const [shiftFilter, setShiftFilter] = useState('todos');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [pendingDrop, setPendingDrop] = useState(null); // Modal DND 
  const [dropAlert, setDropAlert] = useState(null); // Alerta Simples

  const [modalMode, setModalMode] = useState(null); // 'save' | 'import' | null
  const [saveOptions, setSaveOptions] = useState({ type: 'previa', weekId: '' });
  const [importOptions, setImportOptions] = useState({ type: 'previa', weekId: '' });

  const [classesList, setClassesList] = useState([]);
  const [courses, setCourses] = useState([]);
  const [curriculumData, setCurriculumData] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const horariosExibidos = useMemo(() => {
    if (!classTimes || classTimes.length === 0) {
      return ['07:30 - 08:20', '08:20 - 09:10', '09:10 - 10:00', '10:20 - 11:10', '11:10 - 12:00'];
    }
    return classTimes.filter(t => {
       if (shiftFilter === 'todos') return true;
       if (shiftFilter === 'diurno') return t.shift === 'Matutino' || t.shift === 'Vespertino';
       if (shiftFilter === 'noturno') return t.shift === 'Noturno';
       return true;
    }).map(t => t.timeStr);
  }, [classTimes, shiftFilter]);
  const diasExibidos = activeDays && activeDays.length > 0 ? activeDays : ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];

  // Carrega os currículos e turmas direto da fonte
  useEffect(() => {
    async function loadAdminData() {
      setLoadingInitial(true);
      try {
        const [loadedMatrices, loadedClasses, dbSchedules] = await Promise.all([
          apiClient.fetchCurriculum('matrix'),
          apiClient.fetchCurriculum('class'),
          fetch(`/api/schedules?academicYear=${selectedConfigYear}`, { headers: getHeaders() }).then(r => r.json()).catch(() => [])
        ]);

        const uniqueCourses = (loadedMatrices || []).map(m => ({ id: m.id, name: `${m.course} (${m.name})` }));
        setCourses(uniqueCourses);
        
        const safeClasses = loadedClasses || [];
        setClassesList(safeClasses.map(c => ({ ...c, courseId: c.matrixId })));

        const flatData = [];
        safeClasses.forEach(cls => {
          const matrix = (loadedMatrices || []).find(m => m.id === cls.matrixId);
          if (!matrix) return;
          const serie = matrix.series?.find(s => s.id === cls.serieId);
          if (!serie) return;

          serie.disciplines?.forEach(disc => {
             const profs = cls.professorAssignments?.[disc.id];
             const teacherIds = (profs && profs.length > 0) ? profs : ['A Definir'];
             const classRoom = cls.roomAssignments?.[disc.id] || cls.room || '';
             
             // Calcula a quantidade padrao esperada na matriz (Prio 1: Aulas Semanais preenchidas. Prio 2: Cálculo por Carga Horária)
             let numAulas = 1;
             if (disc.aulas_semanais !== undefined && disc.aulas_semanais !== null && disc.aulas_semanais > 0) {
                 numAulas = Number(disc.aulas_semanais);
             } else if (disc.hours && disc.hours > 0) {
                 numAulas = Math.floor(disc.hours / 40);
             } else if (disc.workload && disc.workload > 0) {
                 numAulas = Math.floor(disc.workload / 40);
             }

             flatData.push({
                  id: `${cls.id}_${disc.id}`,
                  classId: String(cls.id),
                  courseId: cls.matrixId,
                  className: cls.name,
                  subjectName: disc.name,
                  teacherIds: teacherIds.map(String),
                  room: classRoom,
                  numAulas: numAulas
             });
          });
        });
        setCurriculumData(flatData);
        setSchedules(Array.isArray(dbSchedules) ? dbSchedules : []);

      } catch (err) {
        console.warn("Erro ao buscar currículo para MasterGrid:", err);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadAdminData();
  }, [selectedConfigYear, refreshTrigger]); // Recarrega os dados caso o usuário mude o ano letivo na interface

  // Pega todas as turmas dos cursos selecionados
  const turmasDoCurso = useMemo(() => {
    if (selectedCourses.length === 0) return [];
    return classesList?.filter(cls => selectedCourses.includes(String(cls.courseId))) || [];
  }, [selectedCourses, classesList]);

 // Estrutura do Grid Baseado no Estado Global de Schedules + Alocação Neutra
// Estrutura do Grid Baseado no Estado Global de Schedules + Alocação Neutra
  useEffect(() => {
    if (selectedCourses.length === 0 || turmasDoCurso.length === 0 || !curriculumData) {
      setAulasNeutras([]); setGrade({}); return;
    }
    const idsTurmas = turmasDoCurso.map(t => String(t.id));
    const disciplinasDoCurso = curriculumData.filter(c => idsTurmas.includes(String(c.classId)));
    const aulasReais = disciplinasDoCurso.map(disciplina => ({
      id: disciplina.id || Math.random().toString(),
      classId: String(disciplina.classId),
      courseId: String(disciplina.courseId),
      className: turmasDoCurso.find(t => String(t.id) === String(disciplina.classId))?.name || 'Turma',
      disciplina: disciplina.subjectName,
      teacherIds: disciplina.teacherIds,
      professores: disciplina.teacherIds.map(id => resolveTeacherName(id, globalTeachersList)),
      sala: disciplina.room || '', 
      cor: getColorHash(disciplina.subjectName),
      numAulas: disciplina.numAulas || 1
    }));
    const initialGrade = {}; const aulasAlocadasIds = [];
    if (schedules && schedules.length > 0) {
      const filtered = schedules.filter(s => 
        selectedCourses.includes(String(s.courseId)) && 
        s.type === selectedType && 
        (s.academic_year === selectedConfigYear || !s.academic_year) && 
        (selectedType === 'padrao' ? true : String(s.week_id) === String(selectedWeek))
      );
      filtered.forEach(schedule => {
        let refCard;
        if (schedule.disciplineId) refCard = aulasReais.find(a => String(a.id) === String(schedule.disciplineId));
        if (!refCard) refCard = aulasReais.find(a => String(a.classId) === String(schedule.classId) && a.teacherIds?.join(',') === String(schedule.teacherId));
        if (refCard) {
             initialGrade[`${schedule.classId}|${schedule.dayOfWeek}|${schedule.slotId}`] = { 
                 ...refCard, 
                 sala: schedule.room || refCard.sala,
                 teacherIds: schedule.teacherId ? String(schedule.teacherId).split(',') : refCard.teacherIds,
                 professores: schedule.teacherId ? String(schedule.teacherId).split(',').map(id => resolveTeacherName(id, globalTeachersList)) : refCard.professores
             };
             aulasAlocadasIds.push(String(refCard.id));
        }
      });
    }
    const pendentes = [];
    aulasReais.forEach(d => { if (!aulasAlocadasIds.includes(String(d.id))) pendentes.push(d); });
    setAulasNeutras(pendentes); setGrade(initialGrade);
  }, [selectedCourses, turmasDoCurso, curriculumData, globalTeachersList, schedules, selectedType, selectedWeek, selectedConfigYear]);

  // Agrupa as aulas pendentes por Turma (Ordenadas Alfabeticamente)
  const neutrasPorTurma = useMemo(() => {
    const agrupado = aulasNeutras.reduce((acc, aula) => {
      if (!acc[aula.className]) acc[aula.className] = [];
      acc[aula.className].push(aula);
      return acc;
    }, {});
    
    Object.keys(agrupado).forEach(turma => {
      agrupado[turma].sort((a, b) => a.disciplina.localeCompare(b.disciplina));
    });

    return agrupado;
  }, [aulasNeutras]);

  // === MOTOR DE PREVENÇÃO DE CONFLITOS (CHOQUE DE HORÁRIO) ===
  const verificarChoqueHorario = (teacherIdsArray, sala, diaId, hora, currentClassId) => {
    let pMsg = null;
    let sMsg = null;

    // 1. Verifica na grade que está sendo editada na tela agora (CORRIGIDO AQUI)
    for (const [key, aula] of Object.entries(grade)) {
      const [kClassId, kDiaId, kHora] = key.split('|');
      if (kDiaId === String(diaId) && kHora === hora && kClassId !== String(currentClassId)) {
         for (const tId of teacherIdsArray) {
           if (tId && tId !== 'A Definir' && tId !== '-' && aula.teacherIds?.includes(tId)) {
              if (!pMsg) pMsg = [];
              pMsg.push(`O professor ${tId} já está na turma ${aula.className}.`);
           }
         }
         if (sala && aula.sala && aula.sala === sala) {
            sMsg = `O ambiente "${sala}" já está alocado para a turma ${aula.className}.`;
         }
      }
    }

    // 2. Verifica no banco global (outros cursos)
    const relRows = schedules?.filter(s => String(s.dayOfWeek) === String(diaId) && s.slotId === hora && String(s.classId) !== String(currentClassId)) || [];
    for (const row of relRows) {
       for (const tId of teacherIdsArray) {
         if (tId && tId !== 'A Definir' && tId !== '-' && row.teacherId && String(row.teacherId).split(',').includes(String(tId))) {
            const turmaConflito = classesList?.find(c => String(c.id) === String(row.classId));
            if (!pMsg) pMsg = [];
            pMsg.push(`Este professor ${tId} já está alocado na turma externa "${turmaConflito?.name || 'Desconhecida'}".`);
         }
       }
       if (sala && row.room && row.room === sala) {
          const turmaConflito = classesList?.find(c => String(c.id) === String(row.classId));
          sMsg = `O espaço/sala "${sala}" já está sendo usado pela turma "${turmaConflito?.name || 'Externa'}".`;
       }
    }
    
    if (pMsg || sMsg) return { profMsg: pMsg?.join(' '), salaMsg: sMsg };
    return null;
  };

  // === FUNÇÕES DE DRAG AND DROP ===
  const handleDragStart = (e, aula, origem) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ aula, origem }));
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDropSlot = (e, classId, diaId, hora) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;

    const { aula, origem } = JSON.parse(data);
    
    if (String(aula.classId) !== String(classId)) {
      setDropAlert(`Ação bloqueada: Tentativa de alocar turma ${aula.className} em coluna de outra turma.`);
      return;
    }

    const slotKey = `${classId}|${diaId}|${hora}`;

    if (grade[slotKey] && origem === 'neutra') {
      setDropAlert("Este card já está ocupado por outra disciplina desta turma!");
      return;
    }

    // Calcula de antemão os slots que tentará preencher
    const dropsToMake = [];
    if (origem !== 'neutra') {
       dropsToMake.push({ slotKey, hora });
    } else {
         const countInGrid = Object.values(grade).filter(g => String(g.classId) === String(aula.classId) && String(g.id) === String(aula.id)).length;
         const maxEsperado = aula.numAulas || 1;
         const faltando = maxEsperado - countInGrid;
         const aulasAmount = faltando > 0 ? faltando : 1;
         
         const startIndex = horariosExibidos.indexOf(hora);
         if (startIndex !== -1) {
             let placed = 0;
             let currentIdx = startIndex;
             while (placed < aulasAmount && currentIdx < horariosExibidos.length) {
                 const targetHora = horariosExibidos[currentIdx];
                 const slotK = `${classId}|${diaId}|${targetHora}`;
                 
                 // Pode pular um slot ocupado para continuar preenchendo? A lógica era apenas parar se confirmar 'não', mas prechia se não ocupado...
                 if (!grade[slotK] || placed === 0) {
                     dropsToMake.push({ slotKey: slotK, hora: targetHora });
                     placed++;
                 }
                 currentIdx++;
             }
         }
    }

    // Identifica todos os conflitos dos drops agrupados
    const conflicts = [];
    for (const drop of dropsToMake) {
        const check = verificarChoqueHorario(aula.teacherIds, aula.sala, diaId, drop.hora, classId);
        if (check) {
           conflicts.push(`[${drop.hora}] ${[check.profMsg, check.salaMsg].filter(Boolean).join(' | ')}`);
        }
    }

    if (conflicts.length > 0) {
       setPendingDrop({
          aula, origem, classId, diaId,
          dropsToMake,
          conflicts
       });
    } else {
       executeDrop(aula, origem, dropsToMake);
    }
  };

  const executeDrop = (aula, origem, dropsToMake) => {
      setGrade(prev => {
         const novaGrade = { ...prev };
         if (origem !== 'neutra') {
            delete novaGrade[origem];
            novaGrade[dropsToMake[0].slotKey] = aula;
         } else {
            dropsToMake.forEach(d => {
               novaGrade[d.slotKey] = aula;
            });
         }
         return novaGrade;
      });
      setPendingDrop(null);
  };

  const handleDropNeutra = (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    const { origem } = JSON.parse(data);

    if (origem !== 'neutra') {
      setGrade(prev => {
        const novaGrade = { ...prev };
        delete novaGrade[origem];
        return novaGrade;
      });
    }
  };

  const handleClonePreviousYear = async () => {
    if (!cloneSourceYear) return;
    try {
      const response = await fetch('/api/schedules?academicYear=' + cloneSourceYear, { headers: getHeaders() });
      if (!response.ok) throw new Error("Falha ao buscar grade do ano anterior");
      const data = await response.json();
      
      const filtered = data.filter(s => 
        selectedCourses.includes(String(s.courseId)) && 
        s.type === 'padrao'
      );
      
      const idsTurmas = turmasDoCurso.map(t => String(t.id));
      const disciplinasDoCurso = curriculumData.filter(c => idsTurmas.includes(String(c.classId)));
      const aulasReais = disciplinasDoCurso.map(disciplina => ({
        id: disciplina.id || Math.random().toString(),
        classId: String(disciplina.classId),
        courseId: String(disciplina.courseId),
        className: turmasDoCurso.find(t => String(t.id) === String(disciplina.classId))?.name || 'Turma',
        disciplina: disciplina.subjectName,
        teacherIds: disciplina.teacherIds,
        professores: disciplina.teacherIds.map(id => resolveTeacherName(id, globalTeachersList)),
        sala: disciplina.room || '', 
        cor: getColorHash(disciplina.subjectName),
        numAulas: disciplina.numAulas || 1
      }));

      const clonedGrade = {};
      const aulasAlocadasIds = [];
      filtered.forEach(schedule => {
        let refCard;
        if (schedule.disciplineId) refCard = aulasReais.find(a => String(a.id) === String(schedule.disciplineId));
        if (!refCard) refCard = aulasReais.find(a => String(a.classId) === String(schedule.classId) && a.teacherIds?.join(',') === String(schedule.teacherId));
        if (refCard) {
             clonedGrade[`${schedule.classId}|${schedule.dayOfWeek}|${schedule.slotId}`] = {
                 ...refCard,
                 sala: schedule.room || refCard.sala,
                 teacherIds: schedule.teacherId ? String(schedule.teacherId).split(',') : refCard.teacherIds,
                 professores: schedule.teacherId ? String(schedule.teacherId).split(',').map(id => resolveTeacherName(id, globalTeachersList)) : refCard.professores
             };
             aulasAlocadasIds.push(String(refCard.id));
        }
      });
      
      const pendentes = [];
      aulasReais.forEach(d => { if (!aulasAlocadasIds.includes(String(d.id))) pendentes.push(d); });
      setAulasNeutras(pendentes);
      setGrade(clonedGrade);
      
      setShowCloneModal(false);
      setCloneSourceYear('');
      alert("Grade baseada no padrão do ano anterior carregada na tela. Faça os ajustes e depois clique em Salvar Novo para registrar no ano atual.");
    } catch (err) {
      alert(err.message);
    }
  };

  // === CONCENTRADOR GLOBAL DE ALERTAS ===
  const dashboardAlerts = useMemo(() => {
    const alerts = [];
    const cellAlerts = {}; 

    Object.entries(grade).forEach(([slotKey, aula]) => {
      const [classId, diaId, hora] = slotKey.split('|');
      cellAlerts[slotKey] = [];

      if (aula && aula.teacherIds && aula.teacherIds.length > 0 && aula.teacherIds[0] !== 'A Definir' && aula.teacherIds[0] !== '-') {
         const strConflito = verificarChoqueHorario(aula.teacherIds, aula.sala, diaId, hora, classId);
         if (strConflito) {
            if (strConflito.profMsg) {
                cellAlerts[slotKey].profAlert = true;
                alerts.push(`[${MAP_DAYS[diaId]} às ${hora} | Turma: ${aula.className}] - Choque de Professor: ${strConflito.profMsg}`);
            }
            if (strConflito.salaMsg) {
                cellAlerts[slotKey].salaAlert = true;
                cellAlerts[slotKey].salaText = strConflito.salaMsg;
                alerts.push(`[${MAP_DAYS[diaId]} às ${hora} | Turma: ${aula.className}] - Choque de Ambiente: ${strConflito.salaMsg}`);
            }
         }

         aula.teacherIds.forEach(tId => {
             if (tId === 'A Definir' || tId === '-') return;
             const profSlots = new Set();
             for (const [k, dObj] of Object.entries(grade)) {
                 if (k.split('|')[1] === diaId && dObj.teacherIds?.includes(tId)) profSlots.add(k.split('|')[2]);
             }
             schedules?.forEach(s => {
                 if (String(s.dayOfWeek) === diaId && s.teacherId && String(s.teacherId).split(',').includes(String(tId))) profSlots.add(s.slotId);
             });

             let m = false; let t = false; let n = false;
             const morningEnds = horariosExibidos.filter(h => parseInt(h.split(':')[0], 10) < 12).pop();
             const afternoonStarts = horariosExibidos.find(h => { const v = parseInt(h.split(':')[0],10); return v >= 12 && v < 18; });
             if (profSlots.has(morningEnds) && profSlots.has(afternoonStarts) && (hora === morningEnds || hora === afternoonStarts)) {
                 const noRest = "Sem descanso (Manhã -> Tarde).";
                 if (!cellAlerts[slotKey].profAlertMsg) cellAlerts[slotKey].profAlertMsg = [];
                 cellAlerts[slotKey].profAlertMsg.push(noRest);
                 cellAlerts[slotKey].profAlert = true;
                 const pName = resolveTeacherName(tId, globalTeachersList).split(' ')[0];
                 if (!alerts.some(a => a.includes(`[${MAP_DAYS[diaId]}] Professor(a) ${pName} leciona sem descanso`))) {
                     alerts.push(`[${MAP_DAYS[diaId]}] Professor(a) ${pName} leciona sem descanso entre Turnos (M->T).`);
                 }
             }

             profSlots.forEach(pt => {
                const val = parseInt(pt.split(':')[0], 10);
                if (val < 12) m = true; else if (val >= 12 && val < 18) t = true; else n = true;
             });
             if (m && t && n) {
                const threeShifts = "Alocado em 3 Turnos no dia.";
                if (!cellAlerts[slotKey].profAlertMsg) cellAlerts[slotKey].profAlertMsg = [];
                cellAlerts[slotKey].profAlertMsg.push(threeShifts);
                cellAlerts[slotKey].profAlert = true;
                const pName = resolveTeacherName(tId, globalTeachersList).split(' ')[0];
                if (!alerts.some(a => a.includes(`[${MAP_DAYS[diaId]}] Professor(a) ${pName} atua`))) {
                     alerts.push(`[${MAP_DAYS[diaId]}] Professor(a) ${pName} atua em 3 Turnos diferentes.`);
                }
             }
         });
      }
    });
    // Remove duplicados gerais de alerts
    return { list: [...new Set(alerts)], perCell: cellAlerts };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, schedules, horariosExibidos]);

  return (
    <div className={`flex flex-col gap-4 animate-in fade-in duration-300 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
      
      {/* CABEÇALHO */}
      <div className={`p-4 rounded-xl border shadow-sm flex flex-col xl:flex-row justify-between items-center gap-4 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <CalendarDays className="text-emerald-500" size={24} />
          <div>
            <h2 className="text-lg font-black uppercase tracking-widest">Matriz do Curso</h2>
            <p className="text-xs text-slate-400 font-bold tracking-wider">Visão simultânea de todas as turmas</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full xl:w-auto">
          {/* SELETOR DE ANO LETIVO */}
          <div className="flex items-center gap-2 px-3 py-2 rounded border bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700">
             <CalendarDays size={16} className="text-emerald-500" />
             <select 
               value={String(selectedConfigYear)} 
               onChange={(e) => {
                 setSelectedCourses([]); 
                 setGrade({}); 
                 setAulasNeutras([]); 
                 setSelectedConfigYear(e.target.value);
               }}
               className="bg-transparent text-sm font-black outline-none cursor-pointer w-[60px] text-emerald-700 dark:text-emerald-400"
             >
               {academicYearsMeta && Object.keys(academicYearsMeta).length > 0 ? (
                 Object.keys(academicYearsMeta).sort((a,b)=>b-a).map(yr => (
                   <option key={yr} value={yr}>{yr}</option>
                 ))
               ) : (
                 <option value={selectedConfigYear}>{selectedConfigYear}</option>
               )}
             </select>
          </div>
          {/* SELETORES DE VISUALIZAÇÃO */}
          <div className="flex flex-col sm:flex-row items-center gap-2 px-2">
             <select
               value={shiftFilter}
               onChange={e => setShiftFilter(e.target.value)}
               className={`px-3 py-2 rounded-lg border shadow-sm outline-none cursor-pointer text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'}`}
               title="Filtrar visualização de linhas"
             >
               <option value="todos">Todos os Turnos</option>
               <option value="diurno">Diurno (Mat/Vesp)</option>
               <option value="noturno">Noturno</option>
             </select>

             <select 
               value={selectedType} onChange={e => setSelectedType(e.target.value)} 
               className={`px-3 py-2 rounded-lg border shadow-sm outline-none cursor-pointer text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'}`}
             >
                 <option value="padrao">Padrão Anual (Base)</option>
                 <option value="previa">Prévia Semanal</option>
                 <option value="atual">Horário Atual</option>
                 <option value="oficial">Histórico Oficial</option>
             </select>

             {selectedType !== 'padrao' && (
               <select
                 value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}
                 className={`px-3 py-2 rounded-lg border shadow-sm outline-none cursor-pointer text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'}`}
               >
                 <option value="">-- Semana --</option>
                 {academicWeeks?.filter(w => w.academic_year === selectedConfigYear).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
               </select>
             )}
          </div>
          
          <div className="relative">
             <div 
               className="flex items-center gap-2 px-3 py-2 rounded border bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
               onClick={() => setIsCoursesOpen(!isCoursesOpen)}
             >
                <Filter size={16} className="text-slate-400" />
                <div className="bg-transparent text-xs font-bold w-48 flex items-center justify-between">
                   <span>{selectedCourses.length === 0 ? '-- Selecionar Cursos --' : `${selectedCourses.length} Curso(s) da Matriz`}</span>
                   <span className="text-[9px] opacity-50">{isCoursesOpen ? '▲' : '▼'}</span>
                </div>
             </div>
             
             {isCoursesOpen && (
                 <>
                   <div className="fixed inset-0 z-40" onClick={() => setIsCoursesOpen(false)} />
                   <div className="absolute top-12 w-64 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl flex flex-col z-50 max-h-60 overflow-y-auto gap-1 right-0 sm:left-0 sm:right-auto">
                      {courses?.map(c => (
                       <label key={c.id} className="flex items-center gap-2 text-[10px] font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 px-2 py-1.5 rounded transition-colors group/label z-50 relative">
                         <input type="checkbox" className="accent-emerald-500 w-3 h-3 cursor-pointer" checked={selectedCourses.includes(String(c.id))} onChange={(e) => {
                           if (e.target.checked) setSelectedCourses(p => [...p, String(c.id)]);
                           else setSelectedCourses(p => p.filter(id => id !== String(c.id)));
                         }} />
                         <span className="group-hover/label:text-emerald-600 dark:group-hover/label:text-emerald-400">{c.name}</span>
                       </label>
                     ))}
                     {courses?.length === 0 && <span className="text-xs p-2 opacity-50">Nenhum curso.</span>}
                   </div>
                 </>
             )}
           </div>
           
           {hiddenClasses.length > 0 && (
             <button onClick={() => setHiddenClasses([])} className="flex items-center justify-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all w-full sm:w-auto shadow-sm">
                 <Eye size={14} /> Restaurar {hiddenClasses.length} Oculta(s)
             </button>
           )}

           <button onClick={() => setShowCloneModal(true)} disabled={selectedCourses.length === 0} className="flex items-center justify-center gap-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 disabled:opacity-50 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all w-full sm:w-auto shadow-sm">
              Clonar de Ano Anterior
           </button>

           <button 
             onClick={() => {
                 if(window.confirm('Limpar grade da tela para criar do zero? (O banco NÃO será apagado até você salvar)')) {
                     const pendentesAtuais = [...aulasNeutras];
                     Object.values(grade).forEach(aula => {
                         if (!pendentesAtuais.some(p => String(p.id) === String(aula.id))) {
                             pendentesAtuais.push(aula);
                         }
                     });
                     setGrade({}); setAulasNeutras(pendentesAtuais);
                 }
             }} 
             disabled={selectedCourses.length === 0} className="flex items-center justify-center gap-2 bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all w-full sm:w-auto shadow-sm"
          >
             <AlertCircle size={14} /> Limpar Tela
          </button>

          <button onClick={() => { setSaveOptions({ type: selectedType, weekId: selectedWeek }); setModalMode('save'); }} disabled={selectedCourses.length === 0} className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all w-full sm:w-auto shadow-sm">
             <Save size={14} /> Alterar ou Salvar Novo
          </button>
          </div>
      </div>

      {dashboardAlerts.list.length > 0 && (
         <div className={`p-4 rounded-xl border flex flex-col gap-2 ${isDarkMode ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
            <h3 className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
               <AlertTriangle size={16} /> Relatório de Alertas Ativos na Grade de Edição ({dashboardAlerts.list.length})
            </h3>
            <ul className="flex flex-col gap-1.5 mt-1">
               {dashboardAlerts.list.map((msg, i) => (
                 <li key={i} className={`text-[11px] font-bold flex items-start gap-2 ${isDarkMode ? 'text-red-300/80' : 'text-red-800/80'}`}>
                    <span className="mt-0.5">•</span> <span>{msg}</span>
                 </li>
               ))}
            </ul>
         </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        
        {/* ÁREA NEUTRA (Lateral Esquerda) */}
        <div 
          className={`lg:w-[22.5%] shrink-0 p-3 rounded-xl border shadow-sm flex flex-col h-[75vh] overflow-y-auto ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
          onDragOver={handleDragOver}
          onDrop={handleDropNeutra}
        >
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center justify-between border-b pb-2 border-slate-700/50">
            <span className="flex items-center gap-2"><AlertCircle size={14} /> Pendentes</span>
            <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">{aulasNeutras.length}</span>
          </h3>
          
          <div className="flex flex-col gap-4">
            {selectedCourses.length === 0 && (
              <div className="text-center text-slate-400 text-xs mt-10 p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                Selecione os Cursos para carregar as disciplinas.
              </div>
            )}

            {Object.entries(neutrasPorTurma).filter(([nomeTurma]) => {
                const turmaObj = turmasDoCurso.find(t => t.name === nomeTurma);
                return turmaObj && !hiddenClasses.includes(turmaObj.id);
            }).map(([nomeTurma, aulas]) => (
              <div key={nomeTurma} className="mb-2">
                <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{nomeTurma}</div>
                <div className="flex flex-col gap-2">
                  {aulas.map(aula => {
                    const countInGrid = Object.values(grade).filter(g => String(g.classId) === String(aula.classId) && String(g.id) === String(aula.id)).length;
                    const qtyPadrao = aula.numAulas || 1;
                    const isZero = countInGrid === 0;

                    return (
                      <div 
                        key={aula.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, aula, 'neutra')}
                        className={`w-full p-2 rounded border shadow-sm flex flex-col gap-1 cursor-grab hover:ring-2 hover:border-emerald-500 ring-emerald-500 transition-all ${(isZero && isDarkMode) ? 'bg-amber-950/20 border-amber-600/50' : (isZero ? 'bg-orange-50/60 border-orange-300' : (isDarkMode ? 'bg-slate-750 border-slate-600 border-l-4 border-l-emerald-500' : 'bg-slate-50 border-slate-200 border-l-4 border-l-emerald-500'))}`}
                      >
                       <div className="flex justify-between items-start gap-1">
                         <div className="flex items-start gap-1 overflow-hidden pt-0.5">
                           <GripVertical size={12} className={`shrink-0 ${isZero ? 'text-amber-500' : 'text-slate-400'}`} />
                           <div className={`text-[9px] font-black uppercase tracking-widest ${isZero ? 'text-amber-600 dark:text-amber-500' : `text-${aula.cor}-500 dark:text-${aula.cor}-400`} leading-tight truncate`} title={`${aula.disciplina} - ${aula.className}`}>
                             {aula.disciplina} <span className="text-[6.5px] ml-1 opacity-70 font-bold tracking-normal">- {aula.className}</span>
                           </div>
                         </div>
                         <div title="Meta de Aulas Semanais Recomendadas / Aulas Já Alocadas" className={`flex items-center gap-1.5 text-[7px] font-black px-1 py-[2px] rounded flex-shrink-0 shadow-sm ${isZero ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' : 'bg-emerald-100 text-emerald-750 dark:bg-emerald-900/40 dark:text-emerald-400'}`}>
                           <span className="flex items-center gap-0.5" title="Carga Horária Semanal"><Target size={8} /> {qtyPadrao}</span>
                           <span className="opacity-40 font-light">/</span>
                           <span className={`flex items-center gap-0.5 ${countInGrid >= qtyPadrao && countInGrid > 0 ? (isDarkMode ? 'text-emerald-300' : 'text-emerald-600') : ''}`} title="Alocadas neste Horário"><CheckCircle2 size={8} /> {countInGrid}</span>
                         </div>
                       </div>
                       <div className="flex justify-between items-center pl-4 pr-1 mt-1">
                          <span className="text-[8px] font-bold text-slate-500 truncate max-w-[80px]">{aula.professores?.map(p => p.split(' ')[0]).join(' + ')}</span>
                          <span className="text-[8px] text-slate-400 flex items-center gap-0.5 truncate bg-black/5 dark:bg-white/5 px-1 py-[1px] rounded"><MapPin size={8} /> {aula.sala ? aula.sala.slice(0, 8) : 'S/Sala'}</span>
                       </div>

                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GRADE MATRIZ PRINCIPAL (As Turmas lado a lado) */}
        <div className={`w-full p-4 rounded-xl border shadow-sm h-[75vh] overflow-auto ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          {selectedCourses.length === 0 ? (
             <div className="flex items-center justify-center h-full text-slate-400 font-bold">
               Nenhum curso selecionado.
             </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 z-10 bg-inherit shadow-sm">
                <tr>
                  <th className="py-2 px-2 w-20 bg-inherit"></th>
                  {turmasDoCurso.filter(t => !hiddenClasses.includes(t.id)).map(turma => (
                    <th key={turma.id} className={`py-2 px-2 text-center text-[11px] font-black uppercase tracking-widest border-b-2 border-slate-700/50 bg-inherit group/th`}>
                      <div className="flex items-center justify-center gap-2 relative">
                         <span className="truncate">{turma.name}</span>
                         <button onClick={() => setHiddenClasses(prev => [...prev, turma.id])} title="Ocultar da Tela" className="opacity-0 group-hover/th:opacity-100 hover:text-rose-500 transition-opacity absolute -right-2 text-slate-400 cursor-pointer">
                            <EyeOff size={11} />
                         </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {diasExibidos.map((diaNome) => {
                  const diaId = String(MAP_DAYS.indexOf(diaNome));
                  return (
                  <React.Fragment key={diaId}>
                    {/* Linha Divisória do Dia */}
                    <tr>
                      <td colSpan={turmasDoCurso.filter(t => !hiddenClasses.includes(t.id)).length + 1} className={`py-1 px-3 text-[10px] font-black uppercase tracking-widest mt-4 ${isDarkMode ? 'bg-slate-700/50 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                        {diaNome}
                      </td>
                    </tr>
                    
                    {/* Horários do Dia */}
                    {horariosExibidos.map((hora, index) => {
                      const numHora = parseInt(hora.split(':')[0], 10);
                      const isAfternoonStart = index > 0 && numHora >= 12 && parseInt(horariosExibidos[index-1].split(':')[0], 10) < 12;
                      const isNightStart = index > 0 && numHora >= 18 && parseInt(horariosExibidos[index-1].split(':')[0], 10) < 18;
                      
                      return (
                      <React.Fragment key={`${diaId}-${hora}`}>
                        {(isAfternoonStart || isNightStart) && (
                           <tr>
                              <td colSpan={turmasDoCurso.filter(t => !hiddenClasses.includes(t.id)).length + 1} className="p-0 h-[3px] bg-slate-300 dark:bg-slate-700 border-none"></td>
                           </tr>
                        )}
                        <tr key={`${diaId}-${hora}-row`}>
                          <td className="py-2 px-2 text-center text-[9px] font-bold text-slate-400 border-r border-slate-700/30 whitespace-nowrap align-middle">
                            {hora}
                          </td>
                        
                        {/* Colunas das Turmas */}
                        {turmasDoCurso.filter(t => !hiddenClasses.includes(t.id)).map(turma => {
                          const slotKey = `${turma.id}|${diaId}|${hora}`;
                          const aulaNesteSlot = grade[slotKey];
                          
                          // Busca dos alertas pré-computados
                          const alertasObj = dashboardAlerts.perCell[slotKey] || { profAlert: false, profAlertMsg: [], salaAlert: false, salaText: '' };
                          const temAlertaProf = alertasObj.profAlert;
                          const profMsgText = alertasObj.profAlertMsg?.length > 0 ? alertasObj.profAlertMsg.join('\n') : 'Conflito de Professor.';
                          const temAlertaSala = alertasObj.salaAlert;
                          
                          return (
                            <td 
                              key={slotKey} 
                              className="p-1 border border-slate-700/30 min-w-[140px]"
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDropSlot(e, turma.id, diaId, hora)}
                            >
                              {aulaNesteSlot ? (
                                <div 
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, aulaNesteSlot, slotKey)}
                                  className={`group/card w-[95%] sm:w-[90%] mx-auto min-h-[56px] rounded border flex flex-col justify-between p-2 cursor-grab hover:ring-2 ring-emerald-500 transition-all shadow-sm overflow-hidden relative ${isDarkMode ? 'bg-slate-700 border-slate-500' : 'bg-white border-slate-300'}`}
                                >
                                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setGrade(prev => { const n = {...prev}; delete n[slotKey]; return n; }); }} className="absolute top-0 right-0 bg-rose-500 hover:bg-rose-600 text-white font-bold p-1 rounded-bl-md z-20 opacity-0 group-hover/card:opacity-100 cursor-pointer transition-opacity shadow-sm" title="Remover Aula do Horário" >
                                    <X size={8} strokeWidth={4} />
                                  </button>

                                  <span className="absolute top-0 right-0 bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300 font-bold px-1 rounded-bl-md text-[7px] group-hover/card:opacity-0 transition-opacity" title={`Qtd Total desta Aula no Horário da Turma`}>
                                     {Object.values(grade).filter(g => String(g.classId) === String(aulaNesteSlot.classId) && String(g.id) === String(aulaNesteSlot.id)).length}/{aulaNesteSlot.numAulas || 1}
                                  </span>

                                  <span className={`text-[9px] w-[80%] font-black uppercase tracking-widest text-${aulaNesteSlot.cor}-500 dark:text-${aulaNesteSlot.cor}-400 leading-tight truncate`} title={`${aulaNesteSlot.disciplina} - ${aulaNesteSlot.className}`}>
                                    {aulaNesteSlot.disciplina} <span className="text-[7px] ml-1 opacity-60 font-bold tracking-normal">- {aulaNesteSlot.className}</span>
                                  </span>
                                  <div className="flex justify-between items-center mt-auto pt-1 gap-1 overflow-hidden" title={temAlertaProf ? profMsgText : "Professor e Local"}>
                                    <span className={`text-[8px] font-bold truncate max-w-[80px] ${temAlertaProf ? 'text-red-500 dark:text-red-400 bg-red-500/10 px-0.5 rounded border border-red-500/20' : 'text-slate-500 dark:text-slate-300'}`}>
                                      {temAlertaProf && <AlertTriangle size={8} className="inline mr-0.5 mb-[1px]" />} {aulaNesteSlot.professores?.map(p => p.split(' ')[0]).join(' + ')}
                                    </span>
                                    {aulaNesteSlot.sala && (
                                      <span className={`text-[8px] font-bold flex items-center gap-0.5 truncate px-1 py-[1px] rounded ${temAlertaSala ? 'bg-amber-500/20 text-amber-600 border border-amber-500/30' : 'bg-black/5 dark:bg-white/5 text-slate-400'}`} title={temAlertaSala ? alertasObj.salaText : "Local da Aula"}>
                                        {temAlertaSala ? <AlertTriangle size={6} className="shrink-0" /> : <MapPin size={6} className="shrink-0" />} {aulaNesteSlot.sala.slice(0, 8)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className={`w-[95%] sm:w-[90%] mx-auto min-h-[56px] rounded border border-dashed flex items-center justify-center transition-colors ${isDarkMode ? 'border-slate-700/50 hover:bg-slate-700/30' : 'border-slate-200 hover:bg-slate-50'}`}>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      </React.Fragment>
                    )})}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* COMPONENTES DE MODAL INLINE PARA MASTERGRID */}
      {dropAlert && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`w-full max-w-sm rounded-xl p-5 shadow-2xl ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-200' : 'bg-white border border-slate-200 text-slate-800'}`}>
               <div className="flex flex-col gap-4 text-center items-center">
                  <AlertCircle size={40} className="text-amber-500" />
                  <h2 className="text-lg font-bold">Ação Bloqueada</h2>
                  <p className="text-xs opacity-80">{dropAlert}</p>
                  <button onClick={() => setDropAlert(null)} className="mt-2 w-full bg-slate-200 dark:bg-slate-700 py-2 rounded-lg font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Entendi</button>
               </div>
            </div>
         </div>
      )}

      {pendingDrop && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className={`w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
               <div className="bg-rose-500/10 p-5 flex border-b border-rose-500/20">
                  <AlertTriangle size={24} className="text-rose-500 shrink-0 mr-3 mt-1" />
                  <div>
                    <h2 className={`font-black uppercase tracking-widest ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>Atenção: Choque Detectado</h2>
                    <p className={`text-[11px] font-bold mt-1 leading-snug ${isDarkMode ? 'text-rose-300/70' : 'text-rose-800/70'}`}>A matriz relatará incorreções operacionais e os registros podem não aprovar caso estes choques sejam salvos como Oficiais e Transversais.</p>
                  </div>
               </div>
               
               <div className="p-5 overflow-y-auto max-h-[40vh] bg-slate-50/50 dark:bg-slate-900/20">
                  <ul className="flex flex-col gap-2">
                     {pendingDrop.conflicts.map((c, i) => (
                        <li key={i} className={`text-[11px] font-bold flex gap-2 p-2.5 rounded whitespace-pre-wrap ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-600 border shadow-sm'}`}>
                           <span className="text-rose-500 font-black shrink-0">•</span>
                           <span>{c}</span>
                        </li>
                     ))}
                  </ul>
               </div>

               <div className={`p-4 border-t flex flex-col sm:flex-row items-center justify-end gap-3 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <button onClick={() => setPendingDrop(null)} className={`w-full sm:w-auto px-4 py-2.5 rounded font-bold text-xs transition-colors ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-white border hover:bg-slate-50 text-slate-600 border-slate-300'}`}>
                     Cancelar Soltura e Voltar
                  </button>
                  <button onClick={() => executeDrop(pendingDrop.aula, pendingDrop.origem, pendingDrop.dropsToMake)} className="w-full sm:w-auto px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded font-bold text-xs shadow hover:shadow-lg transition-all">
                     Forçar Alocação Completa
                  </button>
               </div>
            </div>
         </div>
      )}

      {modalMode === 'save' && (
         <SaveMatrixModal 
           isDarkMode={isDarkMode} grade={grade} selectedCourses={selectedCourses} courses={courses} 
           saveOptions={saveOptions} setSaveOptions={setSaveOptions} 
           academicWeeks={academicWeeks} schedules={schedules} selectedConfigYear={selectedConfigYear}
           loadedType={selectedType} loadedWeek={selectedWeek} 
           onClose={() => setModalMode(null)} 
           onSuccess={() => { setModalMode(null); alert("Grade armazenada com sucesso!"); setRefreshTrigger(prev => prev + 1); }} 
         />
      )}

      {modalMode === 'import' && (
         <ImportMatrixModal 
           isDarkMode={isDarkMode} selectedCourses={selectedCourses}
           importOptions={importOptions} setImportOptions={setImportOptions}
           academicWeeks={academicWeeks} schedules={schedules} selectedConfigYear={selectedConfigYear}
           curriculumData={curriculumData} globalTeachersList={globalTeachersList}
           setGrade={setGrade} setAulasNeutras={setAulasNeutras}
           onClose={() => setModalMode(null)} 
         />
      )}

      {showCloneModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className={`w-full max-w-sm rounded-xl p-5 shadow-2xl ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-200' : 'bg-white border border-slate-200 text-slate-800'}`}>
              <h2 className="text-lg font-bold mb-4">Clonar Base de Ano Anterior</h2>
              <p className="text-xs opacity-80 mb-4">Atenção: Isso buscará horários do tipo 'Padrão Anual' dos cursos selecionados do ano fonte e jogará na tela atual. Depois de revisar, salve.</p>
              
              <select
                value={cloneSourceYear}
                onChange={e => setCloneSourceYear(e.target.value)}
                className={`w-full p-3 rounded-lg border text-sm font-bold mb-4 focus:ring-2 focus:ring-indigo-500 outline-none ${isDarkMode ? 'bg-slate-900 border-slate-600' : 'bg-white border-slate-300'}`}
              >
                <option value="">-- Selecione o Ano Letivo Fonte --</option>
                {academicYearsMeta && Object.keys(academicYearsMeta)
                  .filter(y => y !== String(selectedConfigYear))
                  .sort((a,b)=>b-a)
                  .map(y => <option key={y} value={y}>{y}</option>)
                }
              </select>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                 <button onClick={() => setShowCloneModal(false)} className="px-4 py-2 rounded-lg font-bold text-xs bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors">Cancelar</button>
                 <button onClick={handleClonePreviousYear} disabled={!cloneSourceYear} className="px-4 py-2 rounded-lg font-bold text-xs bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">Confirmar Clonagem</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// SUB-COMPONENTES DE AÇÃO (SALVAR E IMPORTAR)
// -------------------------------------------------------------
function SaveMatrixModal({ isDarkMode, grade, selectedCourses, saveOptions, setSaveOptions, academicWeeks, selectedConfigYear, loadedType, loadedWeek, onClose, onSuccess }) {
  const [isSaving, setIsSaving] = useState(false);
  const currentYearWeeks = useMemo(() => academicWeeks?.filter(w => String(w.academic_year) === String(selectedConfigYear)) || [], [academicWeeks, selectedConfigYear]);

  const availableOptions = useMemo(() => {
      if (loadedType === 'padrao') return [{ value: 'padrao', label: '0. Atualizar: Padrão Anual (Base)' }, { value: 'previa', label: '1. Criar: Prévia Semanal' }];
      if (loadedType === 'previa') return [{ value: 'previa', label: '1. Atualizar: Prévia' }, { value: 'atual', label: '2. Promover para: Atual' }];
      if (loadedType === 'atual') return [{ value: 'atual', label: '2. Atualizar: Atual' }, { value: 'oficial', label: '3. Promover para: Oficial' }];
      if (loadedType === 'oficial') return [{ value: 'oficial', label: '3. Retificar: Oficial' }];
      return [{ value: 'padrao', label: '0. Criar: Padrão Anual (Base)' }, { value: 'previa', label: '1. Criar: Prévia Semanal' }];
  }, [loadedType]);

  useEffect(() => { setSaveOptions({ type: availableOptions[0].value, weekId: loadedWeek }); }, [loadedType, loadedWeek, availableOptions]);

  const handleConfirmSave = async () => {
      const payload = Object.entries(grade).map(([key, aula]) => {
         const [classId, dayOfWeek, slotId] = key.split('|');
         return { courseId: aula.courseId, classId, dayOfWeek, slotId, teacherId: aula.teacherIds ? aula.teacherIds.join(',') : 'A Definir', disciplineId: aula.id.split('_')[1] || aula.id, room: aula.sala };
      });

      if (saveOptions.type !== 'padrao' && !saveOptions.weekId) return alert('Selecione uma semana letiva!');
      if (saveOptions.type === 'oficial' && !window.confirm("⚠️ Você está prestes a salvar um histórico Oficial. Continuar?")) return;

      setIsSaving(true);
      try {
          const resp = await fetch('/api/schedules/bulk-course', {
            method: 'POST', headers: getHeaders(),
            body: JSON.stringify({ courseIds: selectedCourses, type: saveOptions.type, weekId: saveOptions.weekId || null, academicYear: selectedConfigYear, schedules: payload })
          });
          if(!resp.ok) throw new Error('Erro Crítico no Backend!');
          onSuccess();
      } catch(e) { alert(e.message); } finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`w-full max-w-2xl rounded-xl p-6 ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white'}`}>
         <h2 className="text-lg font-black uppercase mb-4">Pipeline de Aprovação</h2>
          <div className={`grid ${saveOptions.type !== 'padrao' ? 'grid-cols-2' : 'grid-cols-1'} gap-4 mb-6`}>
            <div>
              <label className="block text-[10px] font-black uppercase opacity-60 mb-2">Ação Permitida</label>
              <select value={saveOptions.type} onChange={e => setSaveOptions(p => ({...p, type: e.target.value}))} className="w-full p-3 rounded border text-xs font-bold text-black">
                 {availableOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            {saveOptions.type !== 'padrao' && (
              <div>
                <label className="block text-[10px] font-black uppercase opacity-60 mb-2">Semana Destino</label>
                <select value={saveOptions.weekId} onChange={e => setSaveOptions(p => ({...p, weekId: e.target.value}))} className="w-full p-3 rounded border text-xs text-black">
                   <option value="">Selecione...</option>
                   {currentYearWeeks.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}
         </div>
         <div className="flex justify-end gap-3 border-t pt-4">
             <button onClick={onClose} className="px-4 py-2 font-bold text-xs bg-slate-200 text-slate-700 rounded">Cancelar</button>
             <button onClick={handleConfirmSave} disabled={isSaving} className="px-4 py-2 font-bold text-xs bg-emerald-600 text-white rounded">{isSaving ? 'Aguarde...' : 'Confirmar Gravação'}</button>
         </div>
      </div>
    </div>
  );
}