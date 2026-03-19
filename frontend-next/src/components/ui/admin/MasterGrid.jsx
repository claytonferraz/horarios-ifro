import React, { useState, useEffect, useMemo } from 'react';
import { CalendarDays, GripVertical, AlertCircle, Save, Filter, MapPin, Loader2 } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { MAP_DAYS, getColorHash, resolveTeacherName } from '@/lib/dates';
import { apiClient, getHeaders } from '@/lib/apiClient';

export function MasterGrid({ isDarkMode, ...props }) {
  const { globalTeachers: globalTeachersList, activeDays, classTimes } = useData();
  
  const [selectedCourse, setSelectedCourse] = useState('');
  const [aulasNeutras, setAulasNeutras] = useState([]);
  const [grade, setGrade] = useState({});

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
          fetch('/api/schedules', { headers: getHeaders() }).then(r => r.json()).catch(() => [])
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
             
             // Cria as "fichas de aula" para a Área Neutra de acordo com a carga (Ex: 2 aulas semanais = 2 cards)
             const numAulas = disc.aulas_semanais || 1;
             for(let i = 0; i < numAulas; i++) {
               flatData.push({
                  id: `${cls.id}_${disc.id}_${i}`,
                  classId: String(cls.id),
                  className: cls.name,
                  subjectName: disc.name,
                  teacherId: String(teacher),
                  room: classRoom
               });
             }
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
  }, []);

  // Pega todas as turmas do curso selecionado
  const turmasDoCurso = useMemo(() => {
    if (!selectedCourse) return [];
    return classesList?.filter(cls => String(cls.courseId) === String(selectedCourse)) || [];
  }, [selectedCourse, classesList]);

  // Carrega as disciplinas do curso inteiro na Área Neutra
  useEffect(() => {
    if (!selectedCourse || turmasDoCurso.length === 0 || !curriculumData) {
      setAulasNeutras([]);
      setGrade({});
      return;
    }

    const idsTurmas = turmasDoCurso.map(t => String(t.id));
    const disciplinasDoCurso = curriculumData.filter(c => idsTurmas.includes(String(c.classId)));
    
    const aulasReais = disciplinasDoCurso.map(disciplina => ({
      id: disciplina.id || Math.random().toString(),
      classId: String(disciplina.classId),
      className: turmasDoCurso.find(t => String(t.id) === String(disciplina.classId))?.name || 'Turma',
      disciplina: disciplina.subjectName,
      teacherId: disciplina.teacherId,
      professor: resolveTeacherName(disciplina.teacherId, globalTeachersList),
      sala: disciplina.room || '', 
      cor: getColorHash(disciplina.subjectName)
    }));

    setAulasNeutras(aulasReais);
    setGrade({});
  }, [selectedCourse, turmasDoCurso, curriculumData, globalTeachersList]);

  // Agrupa as aulas pendentes por Turma
  const neutrasPorTurma = useMemo(() => {
    return aulasNeutras.reduce((acc, aula) => {
      if (!acc[aula.className]) acc[aula.className] = [];
      acc[aula.className].push(aula);
      return acc;
    }, {});
  }, [aulasNeutras]);

  // === MOTOR DE PREVENÇÃO DE CONFLITOS (CHOQUE DE HORÁRIO) ===
  const verificarChoqueHorario = (teacherId, diaId, hora, currentClassId) => {
    // 1. Verifica na grade que está sendo editada na tela agora (CORRIGIDO AQUI)
    for (const [key, aula] of Object.entries(grade)) {
      const [kClassId, kDiaId, kHora] = key.split('|');
      if (kDiaId === String(diaId) && kHora === hora && aula.teacherId === teacherId && kClassId !== String(currentClassId)) {
        return `CHOQUE NA TELA!\nO professor já está na turma ${aula.className} neste mesmo horário.`;
      }
    }

    // 2. Verifica no banco global (outros cursos)
    const conflitoGlobal = schedules?.find(s => 
      String(s.teacherId) === String(teacherId) && 
      String(s.dayOfWeek) === String(diaId) && 
      s.slotId === hora && 
      String(s.classId) !== String(currentClassId)
    );

    if (conflitoGlobal) {
      const turmaConflito = classesList.find(c => String(c.id) === String(conflitoGlobal.classId));
      return `CHOQUE NO BANCO!\nEste professor já está alocado na turma "${turmaConflito?.name || 'Desconhecida'}" neste horário.`;
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

    const mensagemConflito = verificarChoqueHorario(aula.teacherId, diaId, hora, classId);
    if (mensagemConflito) {
      alert(mensagemConflito);
      return; 
    }

    setGrade(prev => ({ ...prev, [slotKey]: aula }));

    if (origem === 'neutra') {
      setAulasNeutras(prev => prev.filter(item => item.id !== aula.id));
    } else {
      setGrade(prev => {
        const novaGrade = { ...prev };
        delete novaGrade[origem];
        return novaGrade;
      });
    }
  };

  const handleDropNeutra = (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    const { aula, origem } = JSON.parse(data);

    if (origem !== 'neutra') {
      setGrade(prev => {
        const novaGrade = { ...prev };
        delete novaGrade[origem];
        return novaGrade;
      });
      setAulasNeutras(prev => [...prev, aula]);
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
          <div className="flex items-center gap-2 px-3 py-2 rounded border bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700">
             <Filter size={16} className="text-slate-400" />
             <select 
               value={selectedCourse} 
               onChange={(e) => setSelectedCourse(e.target.value)}
               className="bg-transparent text-sm font-bold outline-none cursor-pointer w-48"
             >
               <option value="">-- Selecione o Curso --</option>
               {courses?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
             </select>
          </div>
          <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all">
            <Save size={16} /> Salvar Matriz Completa
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
            {!selectedCourse && (
              <div className="text-center text-slate-400 text-xs mt-10 p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                Selecione um Curso para carregar.
              </div>
            )}

            {Object.entries(neutrasPorTurma).map(([nomeTurma, aulas]) => (
              <div key={nomeTurma} className="mb-2">
                <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{nomeTurma}</div>
                <div className="flex flex-col gap-2">
                  {aulas.map(aula => (
                    <div 
                      key={aula.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, aula, 'neutra')}
                      className={`w-[70%] p-1 rounded border flex flex-col gap-0.5 cursor-grab hover:ring-2 ring-emerald-500 transition-all ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}
                    >
                      <div className="flex items-center gap-1">
                         <GripVertical size={12} className="text-slate-400 shrink-0" />
                         <div className={`text-[9px] font-black uppercase tracking-widest text-${aula.cor}-500 dark:text-${aula.cor}-400 leading-tight line-clamp-1`}>
                           {aula.disciplina}
                         </div>
                      </div>
                      <div className="text-[9px] font-bold text-slate-500 pl-4 truncate">{aula.professor}</div>
                      <div className="text-[8px] text-slate-400 pl-4 flex items-center gap-1">
                        <MapPin size={8} /> {aula.sala || 'Sem Sala'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GRADE MATRIZ PRINCIPAL (As Turmas lado a lado) */}
        <div className={`lg:col-span-4 p-4 rounded-xl border shadow-sm h-[75vh] overflow-auto ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          {!selectedCourse ? (
             <div className="flex items-center justify-center h-full text-slate-400 font-bold">
               Nenhum curso selecionado.
             </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 z-10 bg-inherit shadow-sm">
                <tr>
                  <th className="py-2 px-2 w-20 bg-inherit"></th>
                  {turmasDoCurso.map(turma => (
                    <th key={turma.id} className={`py-2 px-2 text-center text-[11px] font-black uppercase tracking-widest border-b-2 border-slate-700/50 bg-inherit`}>
                      {turma.name}
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
                      <td colSpan={turmasDoCurso.length + 1} className={`py-1 px-3 text-[10px] font-black uppercase tracking-widest mt-4 ${isDarkMode ? 'bg-slate-700/50 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
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
                        {turmasDoCurso.map(turma => {
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
                                  className={`w-[70%] mx-auto h-[26px] rounded border flex flex-col justify-center px-1 cursor-grab hover:ring-2 ring-emerald-500 transition-all shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-700 border-slate-500' : 'bg-white border-slate-300'}`}
                                >
                                  <span className={`text-[9px] font-black uppercase tracking-widest text-${aulaNesteSlot.cor}-500 dark:text-${aulaNesteSlot.cor}-400 leading-none truncate`}>
                                    {aulaNesteSlot.disciplina}
                                  </span>
                                  <div className="flex justify-between items-center mt-0.5 gap-1">
                                    <span className="text-[7px] font-bold text-slate-500 dark:text-slate-300 truncate">
                                      {aulaNesteSlot.professor.split(' ')[0]} {/* Reduzido ao primeiro nome */}
                                    </span>
                                    {aulaNesteSlot.sala && (
                                      <span className="text-[7px] font-bold text-slate-400 flex items-center gap-0.5 truncate">
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
    </div>
  );
}