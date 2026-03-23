import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Users, Printer, AlertCircle, CheckCircle, GripVertical } from 'lucide-react';
import { MAP_DAYS } from '@/lib/dates';

export const ClassGrid = React.memo(({
  mappedSchedules,
  isDarkMode,
  scheduleMode,
  appMode,
  viewMode,
  userRole,
  selectedClass,
  globalTeachers,
  safeDays,
  safeTimes,
  dynamicWeeksList,
  selectedWeek,
  weekLabel,
  pendingRequests,
  handlePrint,
  resolveTeacherName,
  isTeacherPending,
  getColorHash,
  getFormattedDayLabel,
  onDragEnd,
  setEditorModal,
  setExchangeTarget,
  siape
}) => {
  return (
    <div className="space-y-4">
      {/* ALERTS DE SOLICITAÇÃO NA PRÉVIA */}
      {(appMode === 'admin' || userRole === 'gestao' || userRole === 'admin') && scheduleMode === 'previa' && pendingRequests?.length > 0 && (
        <div className={`p-4 rounded-xl border shadow-sm flex items-start gap-4 animate-in slide-in-from-top-2 ${isDarkMode ? 'bg-amber-900/30 border-amber-800/50' : 'bg-amber-50 border-amber-200'}`}>
           <AlertCircle size={24} className="text-amber-500 shrink-0 mt-0.5" />
           <div>
              <h4 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>Atenção: Solicitações Pendentes para esta Semana</h4>
              <p className={`text-xs font-bold mt-1 ${isDarkMode ? 'text-amber-300' : 'text-amber-800'}`}>Você possui {pendingRequests.length} solicitação(ões) de mudança de horário aguardando revisão nesta &quot;Prévia Semanal&quot;. Verifique no painel Administrativo (&quot;Solicitações&quot;).</p>
           </div>
        </div>
      )}
      
      <div className={`rounded-2xl shadow-sm border overflow-hidden animate-in zoom-in-95 duration-500 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
      <div className={`text-white px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print ${scheduleMode === 'padrao' ? (isDarkMode ? 'bg-blue-950' : 'bg-blue-900') : scheduleMode === 'previa' ? (isDarkMode ? 'bg-violet-950' : 'bg-violet-900') : (isDarkMode ? 'bg-emerald-950' : 'bg-emerald-800')}`}>
        <div className="flex items-center gap-2.5">
          <Users size={18} className="opacity-80" />
          <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
            {scheduleMode === 'padrao' && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">PADRÃO</span>}
            {scheduleMode === 'previa' && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">PRÉVIA</span>}
            Grade: {selectedClass}
          </h2>
          {scheduleMode !== 'padrao' && weekLabel && <span className="text-[9px] font-black bg-white/10 px-3 py-1 rounded-full tracking-widest uppercase shadow-inner ml-2">{weekLabel}</span>}
        </div>
        
        <button onClick={handlePrint} className="hidden md:flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 no-print">
          <Printer size={14} /> Imprimir Grade
        </button>
      </div>
      
      <div className="hidden print:block font-black text-[14px] uppercase border-b-[3px] border-black pb-2 tracking-widest mt-4 mb-4 text-black">
        TURMA: {selectedClass} <span className="float-right font-medium text-[10px] bg-black text-white px-2 py-1 rounded-sm">{scheduleMode === 'padrao' ? 'HORÁRIO PADRÃO' : `HORÁRIO ${scheduleMode.toUpperCase()} - ${(weekLabel || selectedWeek).replace('SEM ', 'SEMANA ')}`}</span>
      </div>
      <div className="hidden md:block overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[750px] border-collapse relative text-xs print:w-full print:min-w-0 print:max-w-none print:table-fixed print:border-collapse">
          <thead>
            <tr className={`border-b text-[9px] font-black uppercase tracking-widest text-slate-400 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <th className={`sticky left-0 z-20 py-3 px-4 border-r-[3px] w-28 text-center ${isDarkMode ? 'bg-slate-900 border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.2)]' : 'bg-slate-100 border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.02)]'}`}>Horários</th>
              {safeDays.map(day => (<th key={day} className={`py-3 px-4 border-r-[3px] last:border-r-0 text-center ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}>{getFormattedDayLabel(day)}</th>))}
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
            {(() => {
              const turmaRecords = mappedSchedules.filter(r => r.className === selectedClass);
              const entityShifts = new Set(turmaRecords.map(r => safeTimes.find(t => t.timeStr === r.time)?.shift).filter(Boolean));
              const displayShifts = new Set();
              if (entityShifts.has('Matutino')) displayShifts.add('Matutino');
              if (entityShifts.has('Vespertino')) displayShifts.add('Vespertino');
              if (entityShifts.has('Noturno')) displayShifts.add('Noturno');
              
              const entityTimes = safeTimes.filter(t => displayShifts.has(t.shift));

              let currentShift = '';
              if (entityTimes.length === 0) {
                return <tr><td colSpan={safeDays.length + 1} className="py-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">- Não Letivo -</td></tr>;
              }
                return (
                  <DragDropContext onDragEnd={onDragEnd}>
                    {entityTimes.map((timeObj, index) => {
                      const time = timeObj.timeStr || timeObj;
                      const shift = timeObj.shift || '';
                      const isNewShift = shift && shift !== currentShift;
                      if (isNewShift) currentShift = shift;
                      const isLunch = time === '11:10 - 12:00';
                      
                      return (
                        <React.Fragment key={time}>
                        {isNewShift && (
                          <tr className={`print-interval text-[8px] font-black uppercase tracking-[0.4em] border-y-[3px] ${isDarkMode ? 'bg-slate-800/60 text-slate-500 border-slate-700' : 'bg-slate-100/60 text-slate-400 border-slate-300'}`}>
                            <td colSpan={safeDays.length + 1} className="py-2 text-center shadow-inner">{shift}</td>
                          </tr>
                        )}
                        <tr className="group transition-colors">
                          <td className={`sticky left-0 z-10 py-3 px-4 border-r-[3px] font-bold text-xs whitespace-nowrap text-center ${isDarkMode ? 'bg-slate-800 group-hover:bg-slate-700/50 border-slate-700 text-slate-400 shadow-[2px_0_5px_rgba(0,0,0,0.2)]' : 'bg-white group-hover:bg-slate-50 border-slate-300 text-slate-500 shadow-[2px_0_5px_rgba(0,0,0,0.02)]'}`}>{time}</td>
                          {safeDays.map(day => {
                            const diaIndex = MAP_DAYS.indexOf(day);
                            const aulaNesteSlot = turmaRecords.find(r => r.day === day && r.time === time);
                            const droppableId = `${day}|${time}|${selectedClass}`;
                            return (
                              <Droppable droppableId={droppableId} key={droppableId}>
                                {(provided, snapshot) => (
                                  <td 
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`p-1.5 border-r-[3px] last:border-r-0 align-top w-32 transition-colors ${snapshot.isDraggingOver ? (isDarkMode ? 'bg-indigo-900/40' : 'bg-indigo-100/50') : (isDarkMode ? 'border-slate-700 group-hover:bg-slate-700/30 bg-slate-800/20' : 'border-slate-300 group-hover:bg-slate-50/50 bg-slate-50/20')}`}
                                  >
                                    {aulaNesteSlot ? (
                                      <div className="flex flex-col gap-1.5">
                                        {(() => {
                                          const isPending = !aulaNesteSlot.teacherId || String(aulaNesteSlot.teacherId) === 'A Definir' || String(aulaNesteSlot.teacherId) === '-';
                                          const disciplineName = aulaNesteSlot.subject;
                                          const teacherName = aulaNesteSlot.teacher;
                                          const hasConflict = false; // Resolved in server side now
                                          
                                          return (
                                            <Draggable key={aulaNesteSlot.id || `dnd-${diaIndex}-${time}`} draggableId={String(aulaNesteSlot.id || `dnd-${diaIndex}-${time}`)} index={0} isDragDisabled={appMode === 'aluno'}>
                                              {(drgProvided, drgSnapshot) => (
                                                <div 
                                                  ref={drgProvided.innerRef}
                                                  {...drgProvided.draggableProps}
                                                  {...drgProvided.dragHandleProps}
                                                  onClick={(e) => {
                                                    if (scheduleMode === 'consolidado' || scheduleMode === 'oficial') {
                                                      alert("As aulas do histórico não podem ser substituídas pelo portal do professor. Em caso de necessidade técnica ou retificação, a alteração deve ser lançada pela gestão.");
                                                      return;
                                                    }
                                                    if (appMode === 'professor') {
                                                      if (typeof setExchangeTarget === 'function') {
                                                        setExchangeTarget({ targetClass: selectedClass, targetCourse: aulaNesteSlot.course || '', originalRecord: aulaNesteSlot });
                                                      }
                                                    } else if (appMode !== 'aluno') {
                                                      setEditorModal({ cls: selectedClass, day, time, tObj: timeObj });
                                                    }
                                                  }}
                                                  className={`print-clean-card p-2 rounded-xl border shadow-sm flex flex-col justify-center min-h-[60px] transition-all relative ${drgSnapshot.isDragging ? 'z-50 scale-105 shadow-2xl rotate-2' : 'hover:scale-[1.02] hover:shadow-md active:scale-95'} ${isPending ? (isDarkMode ? 'bg-red-900/30 border-red-800/50 text-red-300' : 'bg-red-50 border-red-300 text-red-800') : hasConflict ? (isDarkMode ? 'bg-rose-950/80 border-rose-500/80 text-rose-200 shadow-[0_0_10px_rgba(225,29,72,0.4)]' : 'bg-rose-100 border-rose-500 text-rose-900 shadow-[0_0_10px_rgba(225,29,72,0.3)]') : getColorHash(disciplineName, isDarkMode)}`}
                                                >
                                                  {appMode !== 'aluno' && (
                                                    <div className="absolute top-1 right-1 opacity-20 group-hover:opacity-100">
                                                       <GripVertical size={10} />
                                                    </div>
                                                  )}
                                                  {isPending && (
                                                     <div className="absolute top-0 left-0 z-10 pointer-events-none print:hidden">
                                                         <span className="text-[6px] font-black uppercase tracking-wide text-white px-1.5 py-0.5 rounded-br-[8px] bg-rose-600 border-r border-b border-rose-700 block animate-pulse shadow-sm shadow-rose-900/30">AULA VAGA</span>
                                                     </div>
                                                  )}
                                                  {aulaNesteSlot.isSubstituted && !isPending && (
                                                     <div className="absolute top-0 left-0 z-10 pointer-events-none print:hidden">
                                                         <span title="Assumida no lugar de uma Vaga" className="text-[6px] font-black uppercase tracking-wide text-white px-1.5 py-0.5 rounded-br-[8px] bg-indigo-600 border-r border-b border-indigo-700 block animate-pulse shadow-sm shadow-indigo-900/30">Substituição</span>
                                                     </div>
                                                  )}
                                                  <p className="subject font-bold text-[10px] leading-tight mb-0.5 text-center">
                                                     {disciplineName}
                                                     {aulaNesteSlot.isSubstituted && aulaNesteSlot.originalSubject && <span className="block text-[8px] sm:text-[9.5px] opacity-80 mt-1 uppercase">Era: {aulaNesteSlot.originalSubject}</span>}
                                                  </p>
                                                  <p className="details text-[8px] font-bold opacity-80 flex items-center justify-center gap-1 uppercase truncate">
                                                    {teacherName}
                                                  </p>
                                                  {aulaNesteSlot.room && <span className={`details text-[8px] font-black tracking-tighter opacity-60 px-1.5 py-0.5 rounded mt-1 w-fit uppercase mx-auto ${isDarkMode ? 'bg-white/10' : 'bg-black/5'}`}>{aulaNesteSlot.room}</span>}
                                                </div>
                                              )}
                                            </Draggable>
                                          );
                                        })()}
                                      </div>
                                    ) : (() => {
                                        const dayHasClasses = turmaRecords.some(r => r.day === day);
                                        const shiftHasClasses = turmaRecords.some(r => r.day === day && safeTimes.find(t => t.timeStr === r.time)?.shift === shift);
                                        
                                        if (!dayHasClasses) {
                                            const isMidLabel = time.includes('08:50') || time.includes('15:00') || time.includes('20:40') || index === 2 || (entityTimes.length === 1 && index === 0);
                                            return (
                                                <div className="w-full h-full min-h-[60px] flex items-center justify-center opacity-60">
                                                    {isMidLabel && <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 print:text-black">Não Letivo</span>}
                                                </div>
                                            );
                                        }
                                        
                                        if (!shiftHasClasses) {
                                            return <div className="w-full h-full min-h-[60px]"></div>;
                                        }

                                        return (
                                          <div className={`w-full h-full min-h-[60px] flex flex-col items-center justify-center p-2 rounded-lg border border-dashed opacity-70 transition-colors ${isDarkMode ? 'bg-slate-800/40 border-slate-600' : 'bg-slate-100 border-slate-300'}`}>
                                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tempo Livre</span>
                                              
                                              {userRole === 'professor' && scheduleMode !== 'padrao' && (
                                                  <button
                                                      onClick={() => {
                                                          if(window.confirm(`Deseja solicitar à coordenação para assumir esta Aula Vaga na ${MAP_DAYS[diaIndex]} às ${time}?`)) {
                                                              alert('Solicitação registrada! A coordenação analisará seu pedido para assumir este horário.');
                                                          }
                                                      }}
                                                      className="mt-2 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-[9px] font-black uppercase tracking-widest rounded-md shadow-sm transition-all active:scale-95 flex items-center gap-1 no-print"
                                                  >
                                                      <CheckCircle size={10} /> Assumir
                                                  </button>
                                              )}
                                          </div>
                                        );
                                    })()}
                                    {provided.placeholder}
                                  </td>
                                )}
                              </Droppable>
                            );
                          })}
                        </tr>
                        {isLunch && (
                          <tr className={`print-interval print:break-inside-avoid print:bg-slate-200 print:text-black print:overflow-hidden text-[8px] font-black uppercase tracking-[0.4em] border-y-[3px] ${isDarkMode ? 'bg-slate-800/60 text-slate-500 border-slate-700' : 'bg-slate-100/60 text-slate-400 border-slate-300'}`}>
                            <td colSpan={safeDays.length + 1} className="py-2 text-center shadow-inner">Intervalo / Almoço</td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </DragDropContext>
                );
            })()}
          </tbody>
        </table>
      </div>
      </div>
      
      {/* Mobile Stacked View (Turma) */}
      <div className="md:hidden no-print p-4 space-y-4">
        {(() => {
          const turmaRecords = mappedSchedules.filter(r => r.className === selectedClass);
          if (turmaRecords.length === 0) {
            return <div className="text-center text-slate-400 font-bold uppercase tracking-widest text-[10px] p-8 border rounded-xl border-dashed">Sem aulas programadas</div>;
          }
          return safeDays.map(day => {
            const dayRecords = turmaRecords.filter(r => r.day === day);
            if (dayRecords.length === 0) return null;
            
            const dayShifts = new Set(dayRecords.map(r => safeTimes.find(t => t.timeStr === r.time)?.shift).filter(Boolean));
            const displayShifts = new Set();
            if (dayShifts.has('Matutino')) displayShifts.add('Matutino');
            if (dayShifts.has('Vespertino')) displayShifts.add('Vespertino');
            if (dayShifts.has('Noturno')) displayShifts.add('Noturno');
            const activeTimes = safeTimes.filter(t => displayShifts.has(t.shift));
            
            return (
              <div key={`mob-${day}`} className={`rounded-xl border overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-white'}`}>
                <div className={`px-4 py-2.5 font-black text-[10px] uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                  {getFormattedDayLabel(day)}
                </div>
                <div className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                  {activeTimes.map((timeObj, idx) => {
                    const time = timeObj.timeStr || timeObj;
                    const records = dayRecords.filter(r => r.time === time);
                    const isLunch = time === '11:10 - 12:00';
                    
                    const timeRow = (
                      <div key={`${day}-${time}-row`} className={`flex items-center gap-3 p-3 transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                        <div className="w-16 shrink-0 text-center">
                           <span className={`block border font-black text-[9px] px-1 py-1 rounded-md shadow-sm opacity-80 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}>{time}</span>
                        </div>
                        <div className="flex-1 space-y-2">
                          {records.length > 0 ? records.map(r => {
                            const isPending = isTeacherPending(r.teacher);
                            return (
                              <div key={`mob-rec-${r.id}`} className={`p-2.5 rounded-lg border shadow-sm flex flex-col justify-center ${isPending ? (isDarkMode ? 'bg-red-900/30 border-red-800/50 text-red-300' : 'bg-red-50 border-red-200 text-red-800') : getColorHash(r.subject, isDarkMode)}`}>
                                <p className="font-black text-[11px] leading-tight mb-1">{r.subject}</p>
                                <p className={`text-[9px] font-bold uppercase tracking-wide truncate ${isPending ? (isDarkMode ? 'text-red-400' : 'text-red-600') : 'opacity-80'}`}>{isPending ? 'SEM PROFESSOR' : resolveTeacherName(r.teacher, globalTeachers)}</p>
                                {r.room && <span className={`text-[8px] font-black uppercase tracking-widest mt-1.5 px-2 py-0.5 rounded w-fit ${isDarkMode ? 'bg-white/10' : 'bg-black/5'}`}>{r.room}</span>}
                              </div>
                            )
                          }) : <div className={`font-black tracking-widest text-[9px] opacity-20 uppercase mx-auto w-fit`}>-</div>}
                        </div>
                      </div>
                    );
                    
                    return (
                      <React.Fragment key={`${day}-${time}-frag`}>
                        {timeRow}
                        {isLunch && (
                           <div className={`py-1.5 text-center text-[7px] font-black uppercase tracking-[0.4em] border-y-[2px] ${isDarkMode ? 'bg-slate-800/40 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                             Intervalo
                           </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
});
