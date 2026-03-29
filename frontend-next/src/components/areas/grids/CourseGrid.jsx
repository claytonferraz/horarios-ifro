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
    const isGridInert = true; 

    const activeTeacherFilter = showOnlyMyClasses ? siape : (padraoFilterTeacher && padraoFilterTeacher !== "Todos" ? padraoFilterTeacher : null);

    const availableCourses = useMemo(() => {
      let filteredSchedules = mappedSchedules;
      if (activeTeacherFilter) {
        filteredSchedules = mappedSchedules.filter(r => {
           const isMatch = r.teacherId && String(r.teacherId).split(',').includes(String(activeTeacherFilter));
           const isVacant = isTeacherPending(r.teacherId || r.teacher);
           return isMatch || isVacant;
        });
      }
      return [...new Set(filteredSchedules.map((r) => r.course))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }, [mappedSchedules, activeTeacherFilter]);

    useEffect(() => {
      if (
        availableCourses.length > 0 &&
        (!activeCourseTab || (activeCourseTab !== "Todos" && !availableCourses.includes(activeCourseTab)))
      ) {
        setActiveCourseTab("Todos");
      }
    }, [availableCourses, activeCourseTab]);

    const handlePrintClick = () => {
      const printWindow = window.open('', '_blank');
      const coursesToPrint = activeCourseTab === "Todos" ? availableCourses : [activeCourseTab];
      
      let html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>Grade de Horários - IFRO</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            @page { size: A4 landscape; margin: 5mm; }
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 10px; background: white; color: black; }
            .course-page { page-break-after: always; padding-bottom: 20px; }
            .course-page:last-child { page-break-after: auto; }
            
            .header { text-align: center; border-bottom: 4px double black; padding-bottom: 10px; margin-bottom: 15px; }
            .header h1 { margin: 0; font-size: 20pt; text-transform: uppercase; font-weight: 900; letter-spacing: -1px; }
            .header p { margin: 5px 0 0 0; font-size: 11pt; font-weight: bold; text-transform: uppercase; font-variant: small-caps; }
            
            .course-name { font-size: 16pt; font-weight: 900; text-transform: uppercase; margin: 15px 0 10px 0; display: block; border-left: 10px solid black; padding-left: 10px; }
            
            table { width: 100%; border-collapse: collapse; border: 2.5pt solid black; table-layout: fixed; }
            th, td { border: 1.2pt solid black !important; padding: 6px 4px; text-align: center; vertical-align: middle; font-size: 9pt; line-height: 1.1; }
            th { background-color: #e5e5e5; font-weight: 900; text-transform: uppercase; height: 35px; }
            
            /* Divisão entre dias na impressão */
            .day-divider { border-top: 3.5pt solid black !important; background-color: #f2f2f2 !important; font-weight: 900; text-transform: uppercase; font-size: 9.5pt; }
            
            .subject { font-weight: 900; font-size: 9pt; text-transform: uppercase; }
            .teacher { font-weight: normal; font-size: 8.5pt; font-style: italic; }
            /* Disciplina e professor na mesma linha conforme solicitado */
            .aula-box { display: block; width: 100%; }
            .room-info { display: block; font-size: 8pt; font-weight: bold; margin-top: 3px; color: #444; border-top: 0.5pt solid #ccc; padding-top: 2px; }
            
            .empty { color: #888; font-weight: normal; opacity: 0.5; }
          </style>
        </head>
        <body>
      `;

      coursesToPrint.forEach(course => {
        const records = mappedSchedules.filter(r => r.course === course);
        const classes = [...new Set(records.map(r => r.className))].sort();
        
        // Sala predominante
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
            <h1>Instituto Federal de Rondônia - Porto Velho Zona Norte</h1>
            <p>Horário Acadêmico | ${course.toUpperCase()} | ${selectedWeek} | ${scheduleMode.toUpperCase()}</p>
          </div>
          <div class="course-name">${course}</div>
          <table>
            <thead>
              <tr>
                <th style="width: 50pt;">DIA</th>
                <th style="width: 100pt;">HORÁRIO</th>
                ${classes.map(cls => `<th>${cls}${classRooms[cls] ? `<br><span style="font-size: 7.5pt; opacity: 0.8;">SALA ${classRooms[cls]}</span>` : ''}</th>`).join('')}
              </tr>
            </thead>
            <tbody>`;

        safeDays.forEach(day => {
          // FILTRAGEM DE TURNOS VAZIOS: Só mostra horários que possuem aula para este curso neste dia
          const activeTimes = safeTimes.filter(t => {
            const ts = t.timeStr || t;
            return records.some(r => r.day === day && r.time === ts);
          });

          if (activeTimes.length > 0) {
            activeTimes.forEach((tObj, tIdx) => {
              const ts = tObj.timeStr || tObj;
              html += `<tr class="${tIdx === 0 ? 'day-divider' : ''}">`;
              if (tIdx === 0) {
                html += `<td rowspan="${activeTimes.length}" style="background: #f2f2f2; font-weight: 900; border-right: 2pt solid black !important;">${day.substring(0,3).toUpperCase()}</td>`;
              }
              html += `<td style="font-weight: 700; background: #fafafa;">${ts}</td>`;
              
              classes.forEach(cls => {
                const r = records.find(rec => rec.className === cls && rec.day === day && rec.time === ts);
                if (r) {
                  html += `<td>
                    <div class="aula-box">
                      <span class="subject">${r.subject}</span> - <span class="teacher">${resolveTeacherName(r.teacher, globalTeachers)}</span>
                      ${r.room && r.room !== classRooms[cls] ? `<span class="room-info">SALA ${r.room}</span>` : ''}
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

        html += `</tbody></table></div>`;
      });

      html += `
        <script>
          window.onload = () => {
            window.print();
            // window.onafterprint = () => window.close();
          };
        </script>
        </body></html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
    };

    return (
      <div className={`flex flex-col gap-8 w-full ${appMode === 'professor' ? 'max-w-full' : 'max-w-7xl'} mx-auto px-4 sm:px-8 mt-8 pb-20`}>
        {/* CABEÇALHO PREMIUM (TELA) */}
        <div className={`relative overflow-hidden p-8 rounded-[2.5rem] shadow-2xl transition-all duration-700 ${scheduleMode === "padrao" ? "bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900" : scheduleMode === "previa" ? "bg-gradient-to-br from-violet-600 via-purple-700 to-fuchsia-900" : "bg-gradient-to-br from-rose-600 via-rose-700 to-orange-900"}`}>
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

            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
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
              <button onClick={handlePrintClick} className="group relative overflow-hidden bg-white text-slate-900 px-8 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all hover:scale-105 hover:shadow-2xl active:scale-95 flex items-center gap-3">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <Printer size={20} className="group-hover:rotate-12 transition-transform" />
                Imprimir Pauta Oficial
              </button>
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO DE CURSOS (TELA) */}
        {availableCourses.length > 0 && (
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
            (activeCourseTab === "Todos" ? availableCourses : [activeCourseTab]).map(course => {
              const courseRecords = mappedSchedules.filter(r => r.course === course);
              const courseClasses = [...new Set(courseRecords.map(r => r.className))].sort();
              
              return (
                <div key={course} className={`group relative rounded-[3rem] border shadow-2xl transition-all duration-500 hover:shadow-indigo-500/5 ${isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-100"}`}>
                  <div className={`px-10 py-6 border-b flex items-center justify-between ${isDarkMode ? "border-slate-800/50" : "border-slate-50"}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-8 rounded-full ${scheduleMode === 'padrao' ? "bg-blue-500" : "bg-rose-500"}`} />
                      <h3 className={`text-lg font-black uppercase tracking-tighter ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>{course}</h3>
                    </div>
                    <span className={`text-[10px] font-black opacity-30 uppercase tracking-[0.3em]`}>{courseClasses.length} Turmas</span>
                  </div>
                  
                  <div className="overflow-x-auto p-4 sm:p-8">
                    <table className="w-full border-separate border-spacing-2">
                       <thead>
                          <tr className={`text-[11px] font-black uppercase tracking-[0.2em] ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                            <th className="py-4 px-2 w-20 text-center">Dia</th>
                            <th className="py-4 px-2 w-44 text-center">Intervalo</th>
                            {courseClasses.map(cls => <th key={cls} className="py-4 px-6 text-center min-w-[180px]">{cls}</th>)}
                          </tr>
                       </thead>
                       <tbody>
                          {safeDays.map(day => {
                            // NA TELA: Mostra todos os horários para dar visão de "grade vazia" se quiserem, pois facilita o arraste se habilitado no futuro.
                            // Mas se o usuário quiser ocultar turnos vazios na TELA também, descomente a filtragem abaixo:
                            // const recordsOfDay = courseRecords.filter(r => r.day === day);
                            // const activeTimes = safeTimes.filter(t => recordsOfDay.some(r => r.time === (t.timeStr || t)));
                            
                            const displayTimes = safeTimes; // Por enquanto, tela mostra tudo para manter o visual premium de grid.
                            
                            return (
                              <React.Fragment key={day}>
                                {displayTimes.map((timeObj, idx) => (
                                  <tr key={timeObj.timeStr} className="group/row">
                                     {idx === 0 && (
                                       <td rowSpan={displayTimes.length} className={`rounded-3xl border-2 border-dashed font-black text-[12px] uppercase text-center rotate-180 align-middle transition-all group-hover:border-indigo-500/50 group-hover:bg-indigo-500/5 ${isDarkMode ? "bg-slate-800/40 border-slate-800 text-slate-600" : "bg-slate-50 border-slate-200 text-slate-400"}`} style={{ writingMode: 'vertical-rl' }}>
                                         {getFormattedDayLabel(day)}
                                       </td>
                                     )}
                                     <td className={`p-4 text-center font-black text-xs tracking-widest ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                                        <div className={`px-4 py-2 rounded-xl border ${isDarkMode ? "border-slate-800 bg-slate-800/50" : "border-slate-100 bg-slate-50/50"}`}>
                                          {timeObj.timeStr}
                                        </div>
                                     </td>
                                     {courseClasses.map(cls => {
                                        const r = courseRecords.find(rec => rec.className === cls && rec.day === day && rec.time === (timeObj.timeStr || timeObj));
                                        return (
                                          <td key={cls} className="p-1 align-middle">
                                             {r ? (
                                                <div className={`group/card relative p-5 rounded-[1.8rem] border-b-[4px] shadow-xl transition-all duration-300 hover:translate-y-[-4px] hover:shadow-2xl overflow-hidden ${getColorHash(r.subject, isDarkMode)}`}>
                                                   <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full translate-x-1/2 -translate-y-1/2 blur-lg group-hover/card:scale-150 transition-transform" />
                                                   <div className="relative z-10 text-center flex flex-col gap-1.5">
                                                      <span className="text-[11px] font-black uppercase leading-tight tracking-tight drop-shadow-sm">{r.subject}</span>
                                                      <div className="flex flex-col items-center gap-0.5 opacity-80">
                                                        <span className="text-[9px] font-bold italic">{resolveTeacherName(r.teacher, globalTeachers)}</span>
                                                        {r.room && <span className="text-[8px] bg-black/20 px-2 py-0.5 rounded-lg mt-1 font-black tracking-widest uppercase">SALA {r.room}</span>}
                                                      </div>
                                                   </div>
                                                </div>
                                             ) : (
                                                <div className={`h-16 rounded-[1.8rem] border-2 border-dashed flex items-center justify-center transition-all ${isDarkMode ? "border-slate-800/50 hover:border-slate-700" : "border-slate-100 hover:border-slate-200"}`}>
                                                   <span className="text-xl font-black opacity-5 tracking-[0.5em]">-</span>
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
