import React from 'react';
import { CheckCircle, AlertTriangle, Printer } from 'lucide-react';

export const VacantGrid = React.memo(({
  mappedSchedules,
  isDarkMode,
  scheduleMode,
  selectedWeek,
  weekLabel,
  safeDays,
  safeTimes,
  dynamicWeeksList,
  handlePrint,
  isTeacherPending,
  getFormattedDayLabel
}) => {
  const pendingRecordsForWeek = mappedSchedules.filter(r => isTeacherPending(r.teacher));
  const pendingCourses = [...new Set(pendingRecordsForWeek.map(r => r.course))].sort((a,b) => a.localeCompare(b));

  if (pendingCourses.length === 0) {
    return (
      <div className="space-y-6 animate-in zoom-in-95 duration-500">
        <div className={`rounded-2xl border p-12 text-center shadow-sm no-print ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <CheckCircle size={40} className="mx-auto text-emerald-400 mb-3" />
          <h3 className={`text-lg font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Nenhuma Aula Vaga</h3>
          <p className={`text-sm font-medium mt-1 max-w-md mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Todas as aulas da semana selecionada já possuem professor atribuído.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in zoom-in-95 duration-500">
      {pendingCourses.map(course => {
        const courseRecords = pendingRecordsForWeek.filter(r => r.course === course);
        const courseClasses = [...new Set(courseRecords.map(r => r.className))].sort();
        const courseDays = safeDays.filter(day => courseRecords.some(r => r.day === day));

        return (
          <div key={course} className={`rounded-2xl shadow-sm border overflow-hidden mb-6 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`text-white px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print ${isDarkMode ? 'bg-red-950' : 'bg-red-900'}`}>
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={18} className="opacity-80" />
                <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                  {scheduleMode === 'padrao' && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">PADRÃO</span>}
                  {scheduleMode === 'previa' && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">PRÉVIA</span>}
                  Aulas Vagas: {course}
                </h2>
                {scheduleMode !== 'padrao' && <span className="text-[9px] font-black bg-white/20 px-3 py-1 rounded-full tracking-widest uppercase shadow-sm ml-2">{dynamicWeeksList?.find(w => w.value === selectedWeek)?.label || selectedWeek}</span>}
              </div>
              <button onClick={handlePrint} className="hidden md:flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 no-print">
                <Printer size={14} /> Imprimir Aulas Vagas
              </button>
            </div>

            <div className="hidden print:block font-black text-[14px] uppercase border-b-[3px] border-black pb-2 tracking-widest mt-4 mb-4 text-black">
              AULAS VAGAS <span className="float-right font-medium text-[10px] bg-black text-white px-2 py-1 rounded-sm">{scheduleMode === 'padrao' ? 'HORÁRIO PADRÃO' : `HORÁRIO ${scheduleMode.toUpperCase()} - ${(weekLabel || selectedWeek).replace('SEM ', 'SEMANA ')}`}</span>
            </div>
            <div className="hidden md:block overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[600px] border-collapse relative text-xs print:w-full print:min-w-0 print:max-w-none print:table-fixed print:border-collapse">
                <thead>
                  <tr className={`border-b text-[9px] font-black uppercase tracking-widest text-slate-400 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <th className={`sticky left-0 z-30 py-3 px-2 border-r-[3px] w-10 min-w-[40px] text-center shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>Dia</th>
                    <th className={`sticky left-[40px] z-20 py-3 px-3 border-r-[3px] w-28 min-w-[112px] text-center shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>Horários</th>
                    {courseClasses.map(cls => (
                      <th key={cls} className={`py-3 px-4 border-r-[3px] last:border-r-0 text-center ${isDarkMode ? 'border-slate-700 text-slate-200' : 'border-slate-300 text-slate-800'}`}>{cls}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                  {courseDays.map((day, dayIndex) => {
                    const activeTimes = safeTimes.filter(timeObj => courseRecords.some(r => r.day === day && r.time === (timeObj.timeStr || timeObj)));

                    if (activeTimes.length === 0) {
                      return (
                        <React.Fragment key={`day-block-${day}-empty`}>
                          <tr className="group transition-colors">
                            <td className={`sticky left-0 z-20 border-r-[3px] align-middle text-center ${isDarkMode ? 'bg-slate-900 border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.2)]' : 'bg-slate-50 border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.02)]'}`}>
                              <div className="flex items-center justify-center h-full w-full min-h-[120px] p-2">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                                  {getFormattedDayLabel(day)}
                                </span>
                              </div>
                            </td>
                            <td colSpan={courseClasses.length + 1} className={`py-4 text-center font-bold text-xs uppercase tracking-widest ${isDarkMode ? 'text-slate-500 bg-slate-800/20' : 'text-slate-400 bg-slate-50/50'}`}>
                              NÃO LETIVO
                            </td>
                          </tr>
                          {dayIndex < courseDays.length - 1 && (
                            <tr className={`border-y-[4px] print:hidden ${isDarkMode ? 'bg-slate-700/40 border-slate-700' : 'bg-slate-300/40 border-slate-300'}`}>
                              <td colSpan={courseClasses.length + 2} className="h-0 p-0"></td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    }

                    return (
                      <React.Fragment key={`day-block-${day}`}>
                        {activeTimes.map((timeObj, index) => {
                          const timeStr = timeObj.timeStr || timeObj;
                          const isFirstRowOfDay = index === 0;
                          const hasLunch = activeTimes.some(t => (t.timeStr || t) === '11:10 - 12:00');
                          const isLunch = timeStr === '11:10 - 12:00';

                          return (
                            <React.Fragment key={`${day}-${timeStr}`}>
                              <tr className="group transition-colors">
                                {isFirstRowOfDay && (
                                  <td
                                    rowSpan={activeTimes.length + (hasLunch ? 1 : 0)}
                                    className={`sticky left-0 z-20 border-r-[3px] align-middle text-center ${isDarkMode ? 'bg-slate-900 border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.2)]' : 'bg-slate-50 border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.02)]'}`}
                                  >
                                    <div className="flex items-center justify-center h-full w-full min-h-[120px]">
                                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                                        {getFormattedDayLabel(day)}
                                      </span>
                                    </div>
                                  </td>
                                )}
                                <td className={`sticky left-[40px] z-10 py-3 px-3 border-r-[3px] font-bold text-xs whitespace-nowrap text-center ${isDarkMode ? 'bg-slate-800 group-hover:bg-slate-700/50 border-slate-700 text-slate-400 shadow-[2px_0_5px_rgba(0,0,0,0.2)]' : 'bg-white group-hover:bg-slate-50 border-slate-300 text-slate-500 shadow-[2px_0_5px_rgba(0,0,0,0.02)]'}`}>
                                  {timeStr}
                                </td>
                                {courseClasses.map(cls => {
                                  const records = courseRecords.filter(r => r.className === cls && r.day === day && r.time === timeStr);
                                  return (
                                    <td key={`${cls}-${timeStr}`} className={`p-1.5 border-r-[3px] last:border-r-0 align-top min-w-[140px] ${isDarkMode ? 'border-slate-700 group-hover:bg-slate-700/30 bg-slate-800/20' : 'border-slate-300 group-hover:bg-slate-50/50 bg-slate-50/20'}`}>
                                      {records.length > 0 ? records.map(r => (
                                        <div key={r.id} className={`print-clean-card p-2.5 rounded-xl border shadow-sm flex flex-col justify-center min-h-[60px] transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 relative pt-4 ${isDarkMode ? 'bg-red-900/30 border-red-800/50' : 'bg-red-50 border-red-300'}`}>
                                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-max">
                                            <span className={`text-[8px] font-black uppercase tracking-widest text-white px-2 py-0.5 rounded shadow-sm ${isDarkMode ? 'bg-red-600 shadow-red-900/50' : 'bg-red-600 shadow-red-200'}`}>Sem Professor</span>
                                          </div>
                                          <p className={`subject font-black text-[11px] leading-tight text-center ${isDarkMode ? 'text-red-300' : 'text-red-900'}`}>
                                            {r.subject}
                                          </p>
                                          {r.room && <span className={`details text-[8px] font-black tracking-tighter opacity-70 px-1.5 py-0.5 rounded mt-1 w-fit uppercase mx-auto ${isDarkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-200/50 text-red-900'}`}>{r.room}</span>}
                                        </div>
                                      )) : <div className={`h-[60px] flex items-center justify-center font-black text-[9px] tracking-widest uppercase select-none ${isDarkMode ? 'opacity-20' : 'opacity-5'}`}>-</div>}
                                    </td>
                                  );
                                })}
                              </tr>
                              {isLunch && (
                                <tr className={`print-interval print:break-inside-avoid print:bg-slate-200 print:text-black print:overflow-hidden text-[8px] font-black uppercase tracking-[0.4em] border-y-[3px] ${isDarkMode ? 'bg-slate-800/60 text-slate-500 border-slate-700' : 'bg-slate-100/60 text-slate-400 border-slate-300'}`}>
                                  <td colSpan={courseClasses.length + 1} className="py-2 text-center shadow-inner">Intervalo / Almoço</td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                        {/* Separador entre os dias na matriz */}
                        {dayIndex < courseDays.length - 1 && (
                          <tr className={`border-y-[4px] print:hidden ${isDarkMode ? 'bg-slate-700/40 border-slate-700' : 'bg-slate-300/40 border-slate-300'}`}>
                            <td colSpan={courseClasses.length + 2} className="py-1 shadow-inner"></td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked View (Aulas Vagas) */}
            <div className="md:hidden no-print p-4 space-y-4">
              {courseDays.map(day => {
                const dayRecords = courseRecords.filter(r => r.day === day);
                if (dayRecords.length === 0) return null;
                
                const activeTimes = safeTimes.filter(t => dayRecords.some(r => r.time === (t.timeStr || t)));
                
                return (
                  <div key={`mob-vagas-${course}-${day}`} className={`rounded-xl border overflow-hidden shadow-sm animate-in fade-in ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-white'}`}>
                    <div className={`px-4 py-2.5 font-black text-[10px] uppercase tracking-widest ${isDarkMode ? 'bg-red-950/50 text-red-400' : 'bg-red-50 text-red-700'}`}>
                      {getFormattedDayLabel(day)}
                    </div>
                    <div className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                      {activeTimes.map((timeObj, idx) => {
                        const time = timeObj.timeStr || timeObj;
                        const records = dayRecords.filter(r => r.time === time);
                        const isLunch = time === '11:10 - 12:00';
                        
                        const timeRow = (
                          <div key={`${course}-${day}-${time}-row`} className={`flex items-start gap-3 p-3 transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                            <div className="w-16 shrink-0 text-center">
                               <span className={`block border font-black text-[9px] px-1 py-1 rounded-md shadow-sm opacity-80 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}>{time}</span>
                            </div>
                            <div className="flex-1 space-y-2">
                              {records.map(r => (
                                <div key={`mob-rec-${r.id}`} className={`p-2.5 rounded-lg border shadow-sm flex flex-col justify-center ${isDarkMode ? 'bg-red-900/30 border-red-800/50 text-red-300' : 'bg-red-50 border-red-200 text-red-900'}`}>
                                  <div className="flex items-center gap-1.5 flex-1 w-full">
                                    <span className={`text-[8px] font-black uppercase rounded px-1 shrink-0 ${isDarkMode ? 'bg-red-950 text-red-400' : 'bg-red-200 text-red-800'}`}>{r.className}</span>
                                    <span className="font-bold text-[10px] leading-tight truncate">{r.subject}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                        
                        return (
                          <React.Fragment key={`${course}-${day}-${time}-frag`}>
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
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});
