import React, { useState, useEffect, useMemo } from 'react';
import { CalendarDays, GripVertical, AlertCircle, Save, Filter, MapPin, Loader2, Download, X, Check, Layers, Trash2, Eye, EyeOff, Target, CheckCircle2 } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { MAP_DAYS, getColorHash, resolveTeacherName } from '@/lib/dates';
import { apiClient, getHeaders } from '@/lib/apiClient';

export function MasterGrid({ isDarkMode, ...props }) {
  const { globalTeachers: globalTeachersList, activeDays, classTimes, academicWeeks, selectedConfigYear, setSelectedConfigYear, academicYearsMeta } = useData();
  
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [isCoursesOpen, setIsCoursesOpen] = useState(false);
  const [hiddenClasses, setHiddenClasses] = useState([]);
  const [aulasNeutras, setAulasNeutras] = useState([]);
  const [grade, setGrade] = useState({});

  const [modalMode, setModalMode] = useState(null); // 'save' | 'import' | null
  const [saveOptions, setSaveOptions] = useState({ type: 'padrao', weekId: '' });
  const [importOptions, setImportOptions] = useState({ type: 'padrao', weekId: '' });

  const [classesList, setClassesList] = useState([]);
  const [courses, setCourses] = useState([]);
  const [curriculumData, setCurriculumData] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const rawHorarios = classTimes && classTimes.length > 0 ? classTimes : ['07:30 - 08:20', '08:20 - 09:10', '09:10 - 10:00', '10:20 - 11:10', '11:10 - 12:00'];
  const horariosExibidos = rawHorarios.map(h => typeof h === 'string' ? h : h.timeStr);
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
             const teacher = (profs && profs.length > 0) ? profs[0] : 'A Definir';
             const classRoom = cls.roomAssignments?.[disc.id] || cls.room || '';
             
             // Calcula a quantidade padrao esperada na matriz (Prio 1: Aulas Semanais preenchidas. Prio 2: Cálculo por Carga Horária)
             let numAulas = 1;
             if (disc.aulas_semanais !== undefined && disc.aulas_semanais !== null && disc.aulas_semanais > 0) {
                 numAulas = Number(disc.aulas_semanais);
             } else if (disc.workload && disc.workload > 0) {
                 numAulas = Math.floor(disc.workload / 40);
             }

             flatData.push({
                  id: `${cls.id}_${disc.id}`,
                  classId: String(cls.id),
                  courseId: cls.matrixId,
                  className: cls.name,
                  subjectName: disc.name,
                  teacherId: String(teacher),
                  room: classRoom,
                  numAulas: numAulas
             });
          });
        });
        setCurriculumData(flatData);
        setSchedules(dbSchedules);

      } catch (err) {
        console.warn("Erro ao buscar currículo para MasterGrid:", err);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadAdminData();
  }, [selectedConfigYear]); // Recarrega os dados caso o usuário mude o ano letivo na interface

  // Pega todas as turmas dos cursos selecionados
  const turmasDoCurso = useMemo(() => {
    if (selectedCourses.length === 0) return [];
    return classesList?.filter(cls => selectedCourses.includes(String(cls.courseId))) || [];
  }, [selectedCourses, classesList]);

  // Carrega as disciplinas dos cursos inteiros na Área Neutra
  useEffect(() => {
    if (selectedCourses.length === 0 || turmasDoCurso.length === 0 || !curriculumData) {
      setAulasNeutras([]);
      setGrade({});
      return;
    }

    const idsTurmas = turmasDoCurso.map(t => String(t.id));
    const disciplinasDoCurso = curriculumData.filter(c => idsTurmas.includes(String(c.classId)));
    
    const aulasReais = disciplinasDoCurso.map(disciplina => ({
      id: disciplina.id || Math.random().toString(),
      classId: String(disciplina.classId),
      courseId: String(disciplina.courseId),
      className: turmasDoCurso.find(t => String(t.id) === String(disciplina.classId))?.name || 'Turma',
      disciplina: disciplina.subjectName,
      teacherId: disciplina.teacherId,
      professor: resolveTeacherName(disciplina.teacherId, globalTeachersList),
      sala: disciplina.room || '', 
      cor: getColorHash(disciplina.subjectName),
      numAulas: disciplina.numAulas || 1
    }));

    setAulasNeutras(aulasReais);
    setGrade({});
  }, [selectedCourses, turmasDoCurso, curriculumData, globalTeachersList]);

  // Agrupa as aulas pendentes por Turma
  const neutrasPorTurma = useMemo(() => {
    return aulasNeutras.reduce((acc, aula) => {
      if (!acc[aula.className]) acc[aula.className] = [];
      acc[aula.className].push(aula);
      return acc;
    }, {});
  }, [aulasNeutras]);

  // === MOTOR DE PREVENÇÃO DE CONFLITOS (CHOQUE DE HORÁRIO) ===
  const verificarChoqueHorario = (teacherId, sala, diaId, hora, currentClassId) => {
    // 1. Verifica na grade que está sendo editada na tela agora (CORRIGIDO AQUI)
    for (const [key, aula] of Object.entries(grade)) {
      const [kClassId, kDiaId, kHora] = key.split('|');
      if (kDiaId === String(diaId) && kHora === hora && kClassId !== String(currentClassId)) {
         if (teacherId && teacherId !== 'A Definir' && teacherId !== '-' && aula.teacherId === teacherId) {
            return `CHOQUE DE PROFESSOR NA TELA!\nO professor já está na turma ${aula.className} neste mesmo horário.`;
         }
         if (sala && aula.sala && aula.sala === sala) {
            return `CHOQUE DE SALA NA TELA!\nO espaço/sala "${sala}" já está alocado para a turma ${aula.className} neste mesmo horário.`;
         }
      }
    }

    // 2. Verifica no banco global (outros cursos)
    const relRows = schedules?.filter(s => String(s.dayOfWeek) === String(diaId) && s.slotId === hora && String(s.classId) !== String(currentClassId)) || [];
    for (const row of relRows) {
       if (teacherId && teacherId !== 'A Definir' && teacherId !== '-' && String(row.teacherId) === String(teacherId)) {
          const turmaConflito = classesList?.find(c => String(c.id) === String(row.classId));
          return `CHOQUE DE PROFESSOR GLOBAL!\nEste professor já está alocado na turma "${turmaConflito?.name || 'Externa'}" neste horário.`;
       }
       if (sala && row.room && row.room === sala) {
          const turmaConflito = classesList?.find(c => String(c.id) === String(row.classId));
          return `CHOQUE DE SALA GLOBAL!\nO espaço/sala "${sala}" já está sendo usado pela turma "${turmaConflito?.name || 'Externa'}" neste horário.`;
       }
    }
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
      alert(`Erro: Você está tentando colocar uma aula da ${aula.className} na coluna de outra turma!`);
      return;
    }

    const slotKey = `${classId}|${diaId}|${hora}`;

    if (grade[slotKey]) {
      alert("Este horário já está ocupado por outra disciplina desta turma!");
      return;
    }

    let globalIgnore = false;
    const mensagemConflito = verificarChoqueHorario(aula.teacherId, aula.sala, diaId, hora, classId);
    if (mensagemConflito) {
      if (!window.confirm(`${mensagemConflito}\n\nDeseja forçar a alocação ignorando este aviso?\n(Obs: O sistema de Matriz Padrão, futuramente, não deixará você salvar este choque transversal).`)) {
         return; 
      }
      globalIgnore = true;
    }

    setGrade(prev => {
      const novaGrade = { ...prev };
      
      if (origem !== 'neutra') {
        delete novaGrade[origem];
        novaGrade[slotKey] = aula;
      } else {
        const startIndex = horariosExibidos.indexOf(hora);
        if (startIndex !== -1) {
            let placed = 0;
            let currentIdx = startIndex;
            const aulasAmount = aula.numAulas || 1;
            let ignoreAlerts = globalIgnore;

            while (placed < aulasAmount && currentIdx < horariosExibidos.length) {
                const targetHora = horariosExibidos[currentIdx];
                const slotK = `${classId}|${diaId}|${targetHora}`;

                if (placed === 0) {
                     novaGrade[slotK] = aula;
                     placed++;
                } else if (!novaGrade[slotK]) {
                     const slotErrorMsg = verificarChoqueHorario(aula.teacherId, aula.sala, diaId, targetHora, classId);
                     if (slotErrorMsg && !ignoreAlerts) {
                        if (!window.confirm(`${slotErrorMsg}\n\nConflito detectado na continuação automática das próximas aulas. Deseja forçar e ignorar todos os avisos em cadeia agora?`)) {
                            break;
                        } else {
                            ignoreAlerts = true;
                            novaGrade[slotK] = aula;
                            placed++;
                        }
                     } else {
                        novaGrade[slotK] = aula;
                        placed++;
                     }
                }
                currentIdx++;
            }
        }
      }
      return novaGrade;
    });
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

           <button onClick={() => setModalMode('import')} disabled={selectedCourses.length === 0} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all w-full sm:w-auto shadow-sm">
             <Download size={14} /> Importar Grade
          </button>
          <button onClick={() => setModalMode('save')} disabled={selectedCourses.length === 0} className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all w-full sm:w-auto shadow-sm">
             <Save size={14} /> Salvar Definitivo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        
        {/* ÁREA NEUTRA (Lateral Esquerda) */}
        <div 
          className={`lg:col-span-1 p-3 rounded-xl border shadow-sm flex flex-col h-[75vh] overflow-y-auto ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
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
                        className={`w-full p-2 max-w-[95%] rounded border shadow-sm flex flex-col gap-1 cursor-grab hover:ring-2 hover:border-emerald-500 ring-emerald-500 transition-all ${(isZero && isDarkMode) ? 'bg-amber-950/20 border-amber-600/50' : (isZero ? 'bg-orange-50/60 border-orange-300' : (isDarkMode ? 'bg-slate-750 border-slate-600 border-l-4 border-l-emerald-500' : 'bg-slate-50 border-slate-200 border-l-4 border-l-emerald-500'))}`}
                      >
                       <div className="flex justify-between items-start gap-1">
                         <div className="flex items-start gap-1 overflow-hidden pt-0.5">
                           <GripVertical size={12} className={`shrink-0 ${isZero ? 'text-amber-500' : 'text-slate-400'}`} />
                           <div className={`text-[10px] font-black uppercase tracking-widest ${isZero ? 'text-amber-600 dark:text-amber-500' : `text-${aula.cor}-500 dark:text-${aula.cor}-400`} leading-tight truncate`} title={`${aula.disciplina} - ${aula.className}`}>
                             {aula.disciplina} <span className="text-[7px] ml-1 opacity-60 font-bold tracking-normal">- {aula.className}</span>
                           </div>
                         </div>
                         <div title="Meta de Aulas Semanais Recomendadas / Aulas Já Alocadas" className={`flex items-center gap-1.5 text-[8px] font-black px-1.5 py-[2px] rounded flex-shrink-0 shadow-sm ${isZero ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' : 'bg-emerald-100 text-emerald-750 dark:bg-emerald-900/40 dark:text-emerald-400'}`}>
                           <span className="flex items-center gap-0.5" title="Carga Horária Semanal"><Target size={10} /> {qtyPadrao}</span>
                           <span className="opacity-40 font-light">/</span>
                           <span className={`flex items-center gap-0.5 ${countInGrid >= qtyPadrao && countInGrid > 0 ? (isDarkMode ? 'text-emerald-300' : 'text-emerald-600') : ''}`} title="Alocadas neste Horário"><CheckCircle2 size={10} /> {countInGrid}</span>
                         </div>
                       </div>
                       <div className="flex justify-between items-center pl-4 pr-1 mt-1">
                          <span className="text-[9px] font-bold text-slate-500 truncate max-w-[80px]">{aula.professor?.split(' ')[0]}</span>
                          <span className="text-[9px] text-slate-400 flex items-center gap-0.5 truncate bg-black/5 dark:bg-white/5 px-1 py-[1px] rounded"><MapPin size={8} /> {aula.sala ? aula.sala.slice(0, 8) : 'S/Sala'}</span>
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
        <div className={`lg:col-span-4 p-4 rounded-xl border shadow-sm h-[75vh] overflow-auto ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
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
                    {horariosExibidos.map((hora) => (
                      <tr key={`${diaId}-${hora}`}>
                        <td className="py-2 px-2 text-center text-[9px] font-bold text-slate-400 border-r border-slate-700/30 whitespace-nowrap align-middle">
                          {hora}
                        </td>
                        
                        {/* Colunas das Turmas */}
                        {turmasDoCurso.filter(t => !hiddenClasses.includes(t.id)).map(turma => {
                          const slotKey = `${turma.id}|${diaId}|${hora}`;
                          const aulaNesteSlot = grade[slotKey];

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
                                  className={`w-[85%] sm:w-[75%] mx-auto min-h-[30px] rounded border flex flex-col justify-center px-1.5 py-0.5 cursor-grab hover:ring-2 ring-emerald-500 transition-all shadow-sm overflow-hidden relative ${isDarkMode ? 'bg-slate-700 border-slate-500' : 'bg-white border-slate-300'}`}
                                >
                                  <span className="absolute top-0 right-0 bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300 font-bold px-1 rounded-bl-md text-[7px]" title={`Qtd Total desta Aula no Horário da Turma`}>
                                     {Object.values(grade).filter(g => String(g.classId) === String(aulaNesteSlot.classId) && String(g.id) === String(aulaNesteSlot.id)).length}/{aulaNesteSlot.numAulas || 1}
                                  </span>

                                  <span className={`text-[9px] w-[80%] font-black uppercase tracking-widest text-${aulaNesteSlot.cor}-500 dark:text-${aulaNesteSlot.cor}-400 leading-none truncate mt-1`} title={`${aulaNesteSlot.disciplina} - ${aulaNesteSlot.className}`}>
                                    {aulaNesteSlot.disciplina} <span className="text-[7px] ml-1 opacity-60 font-bold tracking-normal">- {aulaNesteSlot.className}</span>
                                  </span>
                                  <div className="flex justify-between items-center mt-1 gap-1">
                                    <span className="text-[8px] font-bold text-slate-500 dark:text-slate-300 truncate">
                                      {aulaNesteSlot.professor?.split(' ')[0]}
                                    </span>
                                    {aulaNesteSlot.sala && (
                                      <span className="text-[8px] font-bold text-slate-400 flex items-center gap-0.5 truncate bg-black/5 dark:bg-white/5 px-1 py-[1px] rounded" title="Local da Aula">
                                        <MapPin size={6} /> {aulaNesteSlot.sala.slice(0, 8)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className={`w-[70%] mx-auto h-[26px] rounded border border-dashed flex items-center justify-center transition-colors ${isDarkMode ? 'border-slate-700/50 hover:bg-slate-700/30' : 'border-slate-200 hover:bg-slate-50'}`}>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* COMPONENTES DE MODAL INLINE PARA MASTERGRID */}
      {modalMode === 'save' && (
         <SaveMatrixModal 
           isDarkMode={isDarkMode} grade={grade} selectedCourses={selectedCourses} courses={courses} 
           saveOptions={saveOptions} setSaveOptions={setSaveOptions} 
           academicWeeks={academicWeeks} schedules={schedules} selectedConfigYear={selectedConfigYear}
           onClose={() => setModalMode(null)} 
           onSuccess={() => { setModalMode(null); alert("Grade armazenada com sucesso!"); }} 
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
    </div>
  );
}

// -------------------------------------------------------------
// SUB-COMPONENTES DE AÇÃO (SALVAR E IMPORTAR)
// -------------------------------------------------------------
function SaveMatrixModal({ isDarkMode, grade, selectedCourses, courses, saveOptions, setSaveOptions, academicWeeks, schedules, selectedConfigYear, onClose, onSuccess }) {
  const [isSaving, setIsSaving] = useState(false);
  const currentYearWeeks = useMemo(() => academicWeeks?.filter(w => String(w.academic_year) === String(selectedConfigYear)) || [], [academicWeeks, selectedConfigYear]);

  const statusCalc = useMemo(() => {
     const choques = [];
     const payload = [];
     Object.entries(grade).forEach(([key, aula]) => {
         const [classId, dayOfWeek, slotId] = key.split('|');
         payload.push({ courseId: aula.courseId, classId, dayOfWeek, slotId, teacherId: aula.teacherId, disciplineId: aula.id.split('_')[1], room: aula.sala });
         
         const prof = aula.teacherId;
         if (prof && prof !== 'A Definir' && prof !== '-') {
             // Verificar em schedules buscando de outros cursos!
             schedules?.forEach(s => {
                 if (!selectedCourses.includes(String(s.courseId))) {
                     // Somente avalia choque se for da mesma categoria e da mesma semana (se não for Padrão)
                     if (s.type === saveOptions.type && (saveOptions.type === 'padrao' || String(s.week_id) === String(saveOptions.weekId))) {
                        if (String(s.teacherId) === String(prof) && String(s.dayOfWeek) === String(dayOfWeek) && String(s.slotId) === String(slotId)) {
                             const originCourseName = courses?.find(c => String(c.id) === String(s.courseId))?.name || 'Outro Curso';
                             choques.push({ aula, turma: aula.className, msg: `${originCourseName} - ${MAP_DAYS[dayOfWeek]} às ${slotId}` });
                        }
                     }
                 }
             });
         }
     });
     return { payload, choques };
  }, [grade, schedules, selectedCourses, saveOptions, courses]);

  const handleConfirmSave = async () => {
      if (statusCalc.payload.length === 0) return alert('Nenhuma aula lançada na matriz!');
      if (saveOptions.type !== 'padrao' && !saveOptions.weekId) return alert('Selecione uma semana letiva!');
      if (saveOptions.type === 'padrao' && !saveOptions.weekId) return alert('Informe uma versão (Ex: v1) para a grade Padrão!');
      setIsSaving(true);
      try {
          const resp = await fetch('/api/schedules/bulk-course', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
               courseIds: selectedCourses,
               type: saveOptions.type,
               weekId: saveOptions.weekId || null,
               academicYear: selectedConfigYear,
               schedules: statusCalc.payload
            })
          });
          if(!resp.ok) {
             const r = await resp.json().catch(()=>({}));
             throw new Error(r.error || 'Erro Crítico no Backend!');
          }
          onSuccess();
      } catch(e) { 
          alert(e.message); 
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
      <div className={`w-full max-w-3xl rounded-2xl shadow-2xl p-6 flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
         
         <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-black uppercase tracking-widest flex items-center gap-2"><Save size={18} className="text-emerald-500"/> Salvar Matriz do Curso</h2>
              <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1">Configure o ciclo de vida desta grade</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-slate-100/50 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"><X size={16}/></button>
         </div>

         <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Categoria da Matriz</label>
                <select value={saveOptions.type} onChange={e => setSaveOptions(p => ({...p, type: e.target.value}))} className={`w-full px-3 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 font-bold transition-all text-xs outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                   <option value="padrao">Padrão / Template do Ano</option>
                   <option value="previa">Prévia Semanal (Em Avaliação)</option>
                   <option value="oficial">Horário Oficial / Consolidado</option>
                </select>
              </div>
              {saveOptions.type === 'padrao' ? (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest opacity-60 mb-2 text-emerald-600 dark:text-emerald-400">Versão da Matriz Padrão (Sem Semana)</label>
                  <input type="text" placeholder="Ex: v1.0, Inicial, Ajuste 2" value={saveOptions.weekId} onChange={e => setSaveOptions(p => ({...p, weekId: e.target.value}))} className={`w-full px-3 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 font-bold transition-all text-xs outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 focus:bg-slate-700' : 'bg-slate-50 border-slate-200 focus:bg-white'}`} />
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Qual Semana Letiva?</label>
                  <select value={saveOptions.weekId} onChange={e => setSaveOptions(p => ({...p, weekId: e.target.value}))} className={`w-full px-3 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 font-bold transition-all text-xs outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                     <option value="">Selecione...</option>
                     {currentYearWeeks.map(w => <option key={w.id} value={w.id}>{w.name} ({w.start_date.split('-').reverse().join('/')})</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className={`rounded-xl border p-4 ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
               <h3 className="text-xs font-black uppercase tracking-widest mb-3 flex items-center justify-between">
                 <span className="flex items-center gap-2"><MapPin size={14}/> Resumo da Operação</span>
                 <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">{statusCalc.payload.length} Lançamentos</span>
               </h3>
               
               {statusCalc.choques.length > 0 ? (
                  <div className="mt-4 p-4 rounded-xl border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-600">
                     <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-2"><AlertCircle size={14} /> Detectado alerta de choques na matriz {saveOptions.type.toUpperCase()}:</p>
                     <ul className="text-[10px] text-amber-700 dark:text-amber-300 space-y-1 font-medium list-disc pl-4">
                        {statusCalc.choques.map((c, i) => (
                           <li key={i}>
                             Prof(a) <strong className="font-black">{c.aula.professor}</strong> está atribuído em <strong className="font-black">{c.msg}</strong> e na <strong className="font-black">{c.turma}</strong> ao mesmo tempo.
                           </li>
                        ))}
                     </ul>
                  </div>
               ) : (
                  <div className="mt-4 p-4 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 border border-emerald-100 dark:border-emerald-800/50">
                    <Check size={16}/> Excelente! Nenhum choque global detectado com esta configuração.
                  </div>
               )}
            </div>
         </div>

         <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
             <button onClick={onClose} className="py-3 rounded-xl text-[10px] font-black bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors uppercase tracking-widest">
               Voltar à Grade
             </button>
             <button onClick={handleConfirmSave} disabled={isSaving} className="py-3 rounded-xl text-[10px] font-black bg-emerald-600 text-white hover:bg-emerald-700 transition-colors uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
               {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14}/> } Confirmar Gravação
             </button>
         </div>
      </div>
    </div>
  );
}

function ImportMatrixModal({ isDarkMode, selectedCourses, importOptions, setImportOptions, academicWeeks, schedules, selectedConfigYear, curriculumData, globalTeachersList, setGrade, setAulasNeutras, onClose }) {
  const currentYearWeeks = useMemo(() => academicWeeks?.filter(w => String(w.academic_year) === String(selectedConfigYear)) || [], [academicWeeks, selectedConfigYear]);
  
  const handleConfirmImport = () => {
     if (importOptions.type !== 'padrao' && !importOptions.weekId) return alert('Selecione a semana de origem para importar!');
     if (importOptions.type === 'padrao' && !importOptions.weekId) return alert('Digite a versão correta do plano padrão (Ex: v1.0) que deseja buscar!');

     const filtrado = schedules.filter(s => selectedCourses.includes(String(s.courseId)) && s.type === importOptions.type && (importOptions.type === 'padrao' || String(s.week_id) === String(importOptions.weekId)));
     
     if (filtrado.length === 0) {
       alert("Infelizmente não há nenhuma grade gravada com esses parâmetros para importar.");
       return;
     }

     if(!window.confirm("Essa ação vai sobreescrever o que está desenhado agora na grade. Continuar?")) return;
     
     const newGrade = {};
     const usedIds = new Set();
     
     filtrado.forEach(s => {
         const slotKey = `${s.classId}|${s.dayOfWeek}|${s.slotId}`;
         const matchingAulas = curriculumData.filter(c => String(c.classId) === String(s.classId) && !usedIds.has(c.id) && (c.id.includes(`_${s.disciplineId}_`) || (s.disciplineId == null && c.teacherId === s.teacherId)));
         
         if (matchingAulas.length > 0) {
             const aulaReal = matchingAulas[0];
             usedIds.add(aulaReal.id);
             newGrade[slotKey] = { 
               ...aulaReal, 
               cor: getColorHash(aulaReal.subjectName), 
               disciplina: aulaReal.subjectName, 
               professor: resolveTeacherName(s.teacherId || aulaReal.teacherId, globalTeachersList), 
               sala: s.room || aulaReal.room, 
               teacherId: s.teacherId || aulaReal.teacherId 
             };
         }
     });
     
     setGrade(newGrade);
     const pendentes = curriculumData.filter(c => !usedIds.has(c.id)).map(aula => ({
       ...aula, cor: getColorHash(aula.subjectName), disciplina: aula.subjectName, professor: resolveTeacherName(aula.teacherId, globalTeachersList), sala: aula.room
     }));
     setAulasNeutras(pendentes);
     onClose();
  };

  const handleDeleteMatrix = async () => {
    if (importOptions.type === 'oficial') {
        return alert("Bloqueio Definitivo: Matrizes Oficiais/Consolidadas NÃO podem ser totalmente excluídas, pois elas garantem o histórico das aulas ativas e concluídas. Em caso de erros, você deve apenas Importá-la, sobrescrever os horários na tela e Salvar novamente como retificação.");
    }
    if (importOptions.type !== 'padrao' && !importOptions.weekId) return alert('Selecione primeiro qual semana letiva você quer apagar!');
    if (importOptions.type === 'padrao' && !importOptions.weekId) return alert('Digite o nome da versão (Ex: v1.0) que você quer apagar!');

    const filtrado = schedules.filter(s => selectedCourses.includes(String(s.courseId)) && s.type === importOptions.type && (importOptions.type === 'padrao' || String(s.week_id) === String(importOptions.weekId)));
    if (filtrado.length === 0) return alert("Nenhum registro real encontrado com esses parâmetros para excluir.");

    if (importOptions.type === 'padrao') {
       const padroesGerais = schedules.filter(s => selectedCourses.includes(String(s.courseId)) && s.type === 'padrao');
       const versaoUnica = padroesGerais.every(s => String(s.week_id) === String(importOptions.weekId) || !s.week_id);
       if (versaoUnica) {
          return alert("Negado: Esta é a ÚNICA matriz Padrão do Curso para este Ano Letivo. Ela não pode ser excluída, apenas retificada. Deixe pelo menos uma Matriz Base.");
       }
    }

    if (!window.confirm(`ATENÇÃO ABSOLUTA!\n\nA matriz [${importOptions.type.toUpperCase()}] selecionada será EXCLUÍDA PERMANENTEMENTE para todos os ${selectedCourses.length} cursos selecionados.\nDeseja mesmo apagar?`)) return;

    try {
        const url = new URL('/api/schedules/bulk-course', window.location.origin);
        url.searchParams.append('courseIds', selectedCourses.join(','));
        url.searchParams.append('type', importOptions.type);
        url.searchParams.append('academicYear', selectedConfigYear || '');
        if (importOptions.weekId) url.searchParams.append('weekId', importOptions.weekId);

        const resp = await fetch(url, { method: 'DELETE', headers: getHeaders() });
        if(!resp.ok) {
           const err = await resp.json().catch(()=>({}));
           throw new Error(err.error || 'Falha ao excluir matriz do banco.');
        }
        alert("Matriz desestruturada com sucesso!");
        window.location.reload(); // Hard reload do admin pra refresh cache brutal
    } catch(e) {
        alert(e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
      <div className={`w-full max-w-xl rounded-2xl shadow-2xl p-6 flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
         <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-black uppercase tracking-widest flex items-center gap-2"><Download size={18} className="text-blue-500"/> Restaurar Matriz</h2>
              <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1">Carregue um plano de horário salvo anteriormente</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-slate-100/50 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"><X size={16}/></button>
         </div>

         <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Fonte da Matriz</label>
                <select value={importOptions.type} onChange={e => setImportOptions(p => ({...p, type: e.target.value}))} className={`w-full px-3 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 font-bold transition-all text-xs outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                   <option value="padrao">Padrão / Template</option>
                   <option value="previa">Prévia Semanal (Teste)</option>
                   <option value="oficial">Horário Oficial / Consolidado</option>
                </select>
              </div>
              {importOptions.type === 'padrao' ? (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest opacity-60 mb-2 text-blue-600 dark:text-blue-400">Buscar Versão (Matriz Padrão)</label>
                  <input type="text" placeholder="Ex: v1.0, Inicial, Ajuste 2" value={importOptions.weekId} onChange={e => setImportOptions(p => ({...p, weekId: e.target.value}))} className={`w-full px-3 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 font-bold transition-all text-xs outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 focus:bg-slate-700' : 'bg-slate-50 border-slate-200 focus:bg-white'}`} />
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Semana Base</label>
                  <select value={importOptions.weekId} onChange={e => setImportOptions(p => ({...p, weekId: e.target.value}))} className={`w-full px-3 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 font-bold transition-all text-xs outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                     <option value="">Selecione...</option>
                     {currentYearWeeks.map(w => <option key={w.id} value={w.id}>{w.name} ({w.start_date.split('-').reverse().join('/')})</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/40 p-4 rounded-xl">
               <p className="text-xs font-bold text-blue-700 dark:text-blue-400">Ao clicar em confirmar, a grade da tela será <strong className="font-black text-rose-500">sobreescrita e reordenada</strong> com a distribuição salva anteriormente nos termos escolhidos acima.</p>
            </div>
         </div>

         <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
             <button onClick={handleDeleteMatrix} className="py-3 rounded-xl text-[10px] font-black bg-rose-100/50 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40 transition-colors uppercase tracking-widest flex items-center justify-center gap-2">
                 <Trash2 size={14}/> Excluir Fonte
             </button>
             <button onClick={onClose} className="py-3 rounded-xl text-[10px] font-black bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors uppercase tracking-widest">
                 Cancelar
             </button>
             <button onClick={handleConfirmImport} className="py-3 rounded-xl text-[10px] font-black bg-blue-600 text-white hover:bg-blue-700 transition-colors uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">
               <Download size={14}/> Efetivar Carregamento
             </button>
         </div>
      </div>
    </div>
  );
}