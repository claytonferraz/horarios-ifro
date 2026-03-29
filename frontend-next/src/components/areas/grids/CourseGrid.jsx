import React, { useState, useEffect, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  CheckCircle,
  Layers,
  Printer,
  Clock,
  ListTodo,
} from "lucide-react";
import { SearchableSelect } from "../../ui/SearchableSelect";

export const CourseGrid = React.memo(
  ({
    mappedSchedules,
    isDarkMode,
    scheduleMode,
    userRole,
    globalTeachers,
    activeCourseClasses,
    safeDays,
    safeTimes,
    intervals,
    dynamicWeeksList,
    selectedWeek,
    checkPendingSwapRequest,
    weekLabel,
    draggingRecord,
    checkConflict,
    setEditorModal,
    handlePrint: originalHandlePrint,
    getColorHash,
    resolveTeacherName,
    isTeacherPending,
    onDragStart,
    onDragEnd,
    profClassesMemo,
    subjectHoursMeta,
    activeData,
    getFormattedDayLabel,
    appMode,
    showOnlyMyClasses,
    setShowOnlyMyClasses,
    padraoFilterTeacher,
    setPadraoFilterTeacher,
    siape,
    onReverseSwapClick,
  }) => {
    const [mobileSelectedClasses, setMobileSelectedClasses] = useState({});
    const [activeCourseTab, setActiveCourseTab] = useState("Todos");
    const [dbCourses, setDbCourses] = useState([]);
    const [dbClasses, setDbClasses] = useState([]);
    const isGridInert = true; 

    // Resetar filtros de busca por professor logado ao carregar Grade Geral de Horários
    useEffect(() => {
      if (appMode !== 'professor' && !padraoFilterTeacher) {
        if (setShowOnlyMyClasses) setShowOnlyMyClasses(false);
      }
    }, [setShowOnlyMyClasses, appMode, padraoFilterTeacher]);

    useEffect(() => {
      import('@/lib/apiClient').then(({ apiClient }) => {
        Promise.all([
          apiClient.fetchCurriculum('matrix'),
          apiClient.fetchCurriculum('class')
        ]).then(([crs, cls]) => {
          setDbCourses(crs || []);
          setDbClasses(cls || []);
        });
      });
    }, []);

    const activeTeacherFilter = (padraoFilterTeacher && padraoFilterTeacher !== "Todos") ? padraoFilterTeacher : (showOnlyMyClasses ? siape : null);

    // No painel do aluno (aluno ou public), se tiver filtro de professor, forçar modo consolidado
    const isConsolidatedView = activeTeacherFilter || (appMode === 'aluno' && padraoFilterTeacher && padraoFilterTeacher !== "Todos");

    const availableCourses = useMemo(() => {
      // Por padrão, mostra todos os cursos disponíveis nos registros
      return [...new Set(mappedSchedules.map((r) => r.course))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }, [mappedSchedules]);

    useEffect(() => {
      if (
        activeCourseTab !== "Todos" &&
        availableCourses.length > 0 &&
        !availableCourses.includes(activeCourseTab)
      ) {
        setActiveCourseTab("Todos");
      }
    }, [availableCourses, activeCourseTab]);

    const loggedUser = useMemo(() => {
      if (!siape || !globalTeachers) return null;
      return globalTeachers.find(t => String(t.siape || t.id) === String(siape));
    }, [siape, globalTeachers]);
    
    const loggedUserName = loggedUser ? (loggedUser.nome_completo || loggedUser.nome_exibicao) : "Servidor não identificado";

    const handlePrintClick = () => {
      const printWindow = window.open('', '_blank');
      const coursesToPrint = activeCourseTab === "Todos" ? availableCourses : [activeCourseTab];
      const labelStr = dynamicWeeksList.find(w => w.value === selectedWeek)?.label || selectedWeek;
      
      let html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>Grade de Horários - IFRO</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            @page { size: A4 landscape; margin: 5mm; }
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 10px; background: white; color: black; line-height: 1.2; }
            .course-page { page-break-after: always; padding-bottom: 20px; }
            .course-page:last-child { page-break-after: auto; }
            
            .header { text-align: center; border-bottom: 2px solid black; padding-bottom: 8px; margin-bottom: 12px; }
            .header h1 { margin: 0; font-size: 16pt; text-transform: uppercase; font-weight: 900; letter-spacing: 2px; }
            .header p { margin: 4px 0 0 0; font-size: 9pt; font-weight: bold; text-transform: uppercase; }
            .meta-info { display: flex; justify-content: space-between; font-size: 8pt; font-weight: normal; margin-top: 5px; color: #333; }
            
            .course-name { font-size: 12pt; font-weight: 900; text-transform: uppercase; margin: 10px 0 8px 0; display: block; border-left: 6px solid black; padding-left: 8px; }
            
            table { width: 100%; border-collapse: collapse; border: 2pt solid black; table-layout: fixed; }
            th, td { border: 1pt solid black !important; padding: 4px 3px; text-align: center; vertical-align: middle; font-size: 7.5pt; }
            th { background-color: #f0f0f0; font-weight: 900; text-transform: uppercase; height: 28px; font-size: 7pt; }
            
            .day-divider { border-top: 2.5pt solid black !important; background-color: #f9f9f9 !important; }
            .day-label-container { 
               writing-mode: vertical-rl; 
               transform: rotate(180deg); 
               white-space: nowrap;
               font-weight: 900;
               font-size: 8.5pt;
               letter-spacing: 1px;
            }
            
            .subject { font-weight: 900; font-size: 7.2pt; text-transform: uppercase; }
            .teacher { font-weight: normal; font-size: 6.8pt; font-style: italic; }
            .aula-box { display: block; width: 100%; text-align: left; padding: 1px 3px; line-height: 1.1; }
            .room-info { display: block; font-size: 6pt; font-weight: bold; margin-top: 1px; color: #444; opacity: 0.8; }
            
            .empty { color: #ccc; font-weight: normal; }
            .footer-print { margin-top: 10px; font-size: 7pt; font-style: italic; text-align: right; border-top: 1px solid #eee; padding-top: 5px; }
          </style>
        </head>
        <body>
      `;

      coursesToPrint.forEach(course => {
        const records = mappedSchedules.filter(r => r.course === course);
        const classes = [...new Set(records.map(r => r.className))].sort();
        
        // Obter campus da matriz
        const courseObj = (dbCourses || []).find(c => c.course === course);
        const campusName = courseObj?.campus || "Ji-Paraná";

        const classRooms = {};
        classes.forEach(cls => {
          const rooms = records.filter(r => r.className === cls && r.room).map(r => r.room);
          if (rooms.length > 0) {
            const counts = {};
            rooms.forEach(rm => counts[rm] = (counts[rm] || 0) + 1);
            classRooms[cls] = Object.entries(counts).sort((a,b) => b[1] - a[1])[0][0];
          }
        });

        html += `<div class="course-page">
          <div class="header">
            <h1>IFRO Campus ${campusName}</h1>
            <p>${scheduleMode === 'padrao' 
                ? 'Horário Acadêmico Padrão | Versão 1' 
                : `Horário Acadêmico ${scheduleMode === 'previa' 
                    ? 'Prévia' 
                    : scheduleMode === 'consolidado' 
                      ? 'Consolidado' 
                      : 'Em execução'} | ${labelStr}`}</p>
            <div class="meta-info">
              <span>Curso: <strong>${course.toUpperCase()}</strong></span>
              <span>Emitido por: <strong>${loggedUserName}</strong></span>
              <span>Data: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 40pt;">DIA</th>
                <th style="width: 80pt;">HORÁRIO</th>
                ${classes.map(cls => `<th>${cls}${classRooms[cls] ? `<br><span style="font-size: 6.5pt; opacity: 0.8;">SALA ${classRooms[cls]}</span>` : ''}</th>`).join('')}
              </tr>
            </thead>
            <tbody>`;

        safeDays.forEach(day => {
          const activeTimes = safeTimes.filter(t => {
            const ts = t.timeStr || t;
            return records.some(r => r.day === day && r.time === ts);
          });

          if (activeTimes.length > 0) {
            // Calcular data real baseada na label da semana (ex: "Semana de 24/03 a ...")
            let dayAndDate = day.substring(0,3).toUpperCase();
            try {
              // Regex mais flexível: procura o primeiro par DD/MM na string da semana
              const dateParts = labelStr.match(/(\d{2})\/(\d{2})/);
              if (dateParts) {
                const dayVal = parseInt(dateParts[1]);
                const monthVal = parseInt(dateParts[2]) - 1;
                const daysMap = { "Segunda": 0, "Terça": 1, "Quarta": 2, "Quinta": 3, "Sexta": 4, "Sábado": 5, "Domingo": 6 };
                
                // Criar data base para o cálculo
                const dt = new Date(new Date().getFullYear(), monthVal, dayVal);
                dt.setDate(dt.getDate() + (daysMap[day] || 0));
                
                const dFormatted = dt.getDate().toString().padStart(2, '0');
                const mFormatted = (dt.getMonth() + 1).toString().padStart(2, '0');
                dayAndDate += ` ${dFormatted}/${mFormatted}`;
              }
            } catch(e) {
              console.error("Erro ao calcular data para impressão:", e);
            }

            activeTimes.forEach((tObj, tIdx) => {
              const ts = tObj.timeStr || tObj;
              html += `<tr class="${tIdx === 0 ? 'day-divider' : ''}">`;
              if (tIdx === 0) {
                html += `<td rowspan="${activeTimes.length}" style="background: #f0f0f0; border-right: 1.5pt solid black !important;">
                  <div class="day-label-container">${dayAndDate}</div>
                </td>`;
              }
              html += `<td style="font-weight: 700; background: #fafafa; font-size: 7.5pt;">${ts}</td>`;
              
              classes.forEach(cls => {
                const r = records.find(rec => rec.className === cls && rec.day === day && rec.time === ts);
                if (r) {
                  const teacherName = resolveTeacherName(r.teacher, globalTeachers);
                  html += `<td>
                    <div class="aula-box">
                      <div class="subject-line"><span class="subject">${r.subject}</span> - <span class="teacher">${teacherName}</span></div>
                      ${r.room ? `<div class="room-info">S ${r.room}</div>` : ""}
                    </div>
                  </td>`;
                } else {
                  html += `<td class="empty">-</td>`;
                }
              });
              html += `</tr>`;
            });
          }
        });

        html += `</tbody></table>
          <div class="footer-print">Documento gerado automaticamente pelo Sistema de Horários IFRO</div>
        </div>`;
      });

      html += `
        <script>
          window.onload = () => {
            window.print();
          };
        </script>
        </body></html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
    };

    return (
      <div className={`flex flex-col gap-8 w-full ${appMode === 'professor' ? 'max-w-full' : 'max-w-7xl'} mx-auto px-4 sm:px-8 mt-8 pb-20`}>
        {/* CABEÇALHO PREMIUM (TELA) - REMOVIDO OVERFLOW HIDDEN PARA APARECER O SELECT */}
        <div className={`relative p-8 rounded-[2.5rem] shadow-2xl transition-all duration-700 ${scheduleMode === "padrao" ? "bg-gradient-to-br from-indigo-700 via-blue-700 to-emerald-800" : "bg-gradient-to-br from-blue-700 via-teal-700 to-emerald-800"}`}>
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner">
                  <Layers size={28} className="text-white" />
                </div>
                <div>
                  <h2 className="text-white font-black text-2xl uppercase tracking-tighter leading-none">Grade de Horários</h2>
                  <p className="text-white/70 text-[10px] uppercase font-bold tracking-[0.2em] mt-1">Portal do Docente • Gestão Acadêmica</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 bg-black/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 w-fit">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white text-[10px] font-black uppercase tracking-widest">{dynamicWeeksList.find(w => w.value === selectedWeek)?.label || selectedWeek}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto relative z-20">
              {setPadraoFilterTeacher && (
                <div className="flex-1 md:w-72">
                  <SearchableSelect
                    options={[{ value: "Todos", label: "Filtrar por Colega..." }, ...(globalTeachers || []).map(t => ({ value: String(t.siape || t.id), label: t.nome_exibicao || t.nome_completo || "Sem Nome" }))]}
                    value={padraoFilterTeacher}
                    onChange={setPadraoFilterTeacher}
                    isDarkMode={true}
                  />
                </div>
              )}
              <button onClick={handlePrintClick} className="group relative overflow-hidden bg-white text-slate-900 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all hover:scale-105 hover:shadow-2xl active:scale-95 flex items-center gap-3">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <Printer size={20} className="group-hover:rotate-12 transition-transform" />
                Imprimir Pauta Oficial
              </button>
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO DE CURSOS (TELA) - ESCONDER SE TIVER FILTRO DE PROFESSOR OU FOR VISÃO CONSOLIDADA */}
        {!isConsolidatedView && availableCourses.length > 0 && (
          <div className="flex flex-wrap gap-3 animate-in fade-in slide-in-from-left-4 duration-700">
            {["Todos", ...availableCourses].map(c => (
              <button key={c} onClick={() => setActiveCourseTab(c)} className={`px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:translate-y-[-2px] ${activeCourseTab === c ? (isDarkMode ? "bg-slate-700 text-white shadow-xl shadow-indigo-500/20 ring-2 ring-indigo-500" : "bg-indigo-600 text-white shadow-xl shadow-indigo-500/30") : (isDarkMode ? "bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700" : "bg-white text-slate-500 border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 shadow-sm")}`}>
                 {c === "Todos" ? "Todas as Turmas" : c}
              </button>
            ))}
          </div>
        )}

        {/* GRADES VISUAIS (TELA) */}
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          {availableCourses.length === 0 ? (
            <div className={`p-20 rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center text-center ${isDarkMode ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
               <CheckCircle size={64} className="text-emerald-400 opacity-20 mb-4" />
               <h4 className={`text-xl font-black uppercase tracking-widest ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>Sem dados para exibir</h4>
               <p className={`mt-2 text-sm font-medium ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Não encontramos horários para os filtros selecionados.</p>
            </div>
          ) : (
            (isConsolidatedView ? ["Visão Unificada"] : (activeCourseTab === "Todos" ? availableCourses : [activeCourseTab])).map(course => {
              const courseRecords = isConsolidatedView 
                ? mappedSchedules.filter(r => (r.teacherId && String(r.teacherId).split(',').includes(String(activeTeacherFilter))))
                : mappedSchedules.filter(r => r.course === course);
              
              const groupedClasses = [...new Set(courseRecords.map(r => r.className))].sort();
              
              const groupTitle = isConsolidatedView ? `Grade de Horários: ${resolveTeacherName(activeTeacherFilter, globalTeachers)}` : course;
              
              return (
                <div key={course} className={`group relative rounded-[3rem] border shadow-2xl transition-all duration-500 hover:shadow-indigo-500/5 ${isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-100"}`}>
                  <div className={`px-10 py-6 border-b flex items-center justify-between ${isDarkMode ? "border-slate-800/50" : "border-slate-50"}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-8 rounded-full ${scheduleMode === 'padrao' ? "bg-blue-500" : "bg-rose-500"}`} />
                      <h3 className={`text-lg font-black uppercase tracking-tighter ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>{groupTitle}</h3>
                    </div>
                    <span className={`text-[10px] font-black opacity-30 uppercase tracking-[0.3em]`}>{groupedClasses.length} Turmas</span>
                  </div>
                  
                  <div className="overflow-x-auto p-4 sm:p-8">
                    <table className="w-full border-separate border-spacing-1.5">
                       <thead>
                          <tr className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                            <th className="py-2 px-2 w-16 text-center">Dia</th>
                            <th className="py-2 px-2 w-32 text-center">Intervalo</th>
                            {groupedClasses.map(cls => <th key={cls} className="py-2 px-4 text-center min-w-[150px]">{cls}</th>)}
                          </tr>
                       </thead>
                       <tbody>
                          {safeDays.map(day => {
                            // Filtro dinâmico de horários para otimizar espaço - oculta linhas sem nenhuma aula em nenhuma turma do grupo
                            const displayTimes = safeTimes.filter(t => 
                               courseRecords.some(r => r.day === day && r.time === (t.timeStr || t))
                            );

                            if (displayTimes.length === 0) return null;

                            return (
                              <React.Fragment key={day}>
                                {displayTimes.map((timeObj, idx) => (
                                  <tr key={timeObj.timeStr} className="group/row">
                                     {idx === 0 && (
                                       <td rowSpan={displayTimes.length} className={`rounded-2xl border-2 border-dashed font-black text-[10px] uppercase text-center rotate-180 align-middle transition-all group-hover:border-indigo-500/50 group-hover:bg-indigo-500/5 ${isDarkMode ? "bg-slate-800/40 border-slate-800 text-slate-600" : "bg-slate-50 border-slate-200 text-slate-400"}`} style={{ writingMode: 'vertical-rl' }}>
                                         {getFormattedDayLabel(day)}
                                       </td>
                                     )}
                                     <td className={`p-1.5 text-center font-black text-[10px] tracking-widest ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                                        <div className={`px-3 py-1.5 rounded-lg border ${isDarkMode ? "border-slate-800 bg-slate-800/50" : "border-slate-100 bg-slate-50/50"}`}>
                                          {timeObj.timeStr}
                                        </div>
                                     </td>
                                     {groupedClasses.map(cls => {
                                        const r = courseRecords.find(rec => rec.className === cls && rec.day === day && rec.time === (timeObj.timeStr || timeObj));
                                        return (
                                          <td key={cls} className="p-0.5 align-middle">
                                             {r ? (
                                                <div className={`group/card relative p-2.5 rounded-[1.2rem] border-b-[3px] shadow-lg transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl overflow-hidden ${getColorHash(r.subject, isDarkMode)}`}>
                                                   <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-full translate-x-1/2 -translate-y-1/2 blur-md group-hover/card:scale-150 transition-transform" />
                                                   <div className="relative z-10 text-center flex flex-col gap-0.5">
                                                      <span className="text-[10px] font-black uppercase leading-tight tracking-tight drop-shadow-sm truncate">{r.subject}</span>
                                                      <div className="flex flex-col items-center gap-0 opacity-80">
                                                        <span className="text-[8px] font-bold italic truncate w-full">{resolveTeacherName(r.teacher, globalTeachers)}</span>
                                                        {r.room && <span className="text-[7px] bg-black/20 px-1.5 py-0.5 rounded-md mt-0.5 font-black tracking-widest uppercase">SALA {r.room}</span>}
                                                      </div>
                                                   </div>
                                                </div>
                                             ) : (
                                                <div className={`h-10 rounded-[1.2rem] border-2 border-dashed flex items-center justify-center transition-all ${isDarkMode ? "border-slate-800/50 hover:border-slate-700" : "border-slate-100 hover:border-slate-200"}`}>
                                                   <span className="text-sm font-black opacity-5 tracking-[0.3em]">-</span>
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
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }
);
