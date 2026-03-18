import React, { useMemo, useState } from 'react';
import { AlertCircle, TrendingUp, TrendingDown, BellIcon, EyeOff } from 'lucide-react';

export function ScheduleNotifications({ 
  recordsForWeek, 
  subjectHoursMeta, 
  isDarkMode 
}) {
  const [ignored, setIgnored] = useState(false);

  const notifications = useMemo(() => {
    if (!subjectHoursMeta || Object.keys(subjectHoursMeta).length === 0) {
       return { excess: [], deficit: [] };
    }

    const allKnownClasses = {};
    recordsForWeek.forEach(r => {
      if (!r.className || !r.subject) return;
      const key = `${r.course}|${r.className}|${r.subject}`;
      
      if (!allKnownClasses[key]) {
        const serieMatch = r.className.match(/^\d+/);
        allKnownClasses[key] = {
          countAllocated: 0,
          serie: serieMatch ? serieMatch[0] : 'Outras',
          course: r.course,
          className: r.className,
          subject: r.subject
        };
      }
      if (r.day !== 'A Definir' && r.day && r.day !== '-') {
        allKnownClasses[key].countAllocated += 1;
      }
    });

    const finalExcess = [];
    const finalDeficit = [];

    Object.values(allKnownClasses).forEach(c => {
      const subjId = `${c.serie}|${c.subject}`;
      const meta = subjectHoursMeta[subjId];
      if (!meta || !meta.totalHours) return;

      const totalVal = parseInt(meta.totalHours, 10);
      if (isNaN(totalVal) || totalVal <= 0) return;

      const expectedSlotsWeekly = Math.floor(totalVal / 40);
      if (expectedSlotsWeekly <= 0) return;

      if (c.countAllocated > expectedSlotsWeekly) {
        finalExcess.push({ ...c, expected: expectedSlotsWeekly });
      } else if (c.countAllocated < expectedSlotsWeekly) {
        finalDeficit.push({ ...c, expected: expectedSlotsWeekly });
      }
    });

    return {
      excess: finalExcess.sort((a,b) => a.className.localeCompare(b.className)),
      deficit: finalDeficit.sort((a,b) => a.className.localeCompare(b.className))
    };
  }, [recordsForWeek, subjectHoursMeta]);

  if (notifications.excess.length === 0 && notifications.deficit.length === 0) return null;
  if (ignored) {
    return (
      <button onClick={() => setIgnored(false)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'} shadow-sm w-full lg:w-72 justify-between`}>
        <span className="flex items-center gap-2"><BellIcon size={14}/> Notificações Ocultas</span>
        <EyeOff size={14}/>
      </button>
    );
  }

  return (
    <div className={`w-full lg:w-72 shrink-0 rounded-2xl border shadow-sm p-4 h-fit ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center justify-between mb-4">
         <h3 className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
           <BellIcon size={16}/> Alertas de CH
         </h3>
         <button onClick={() => setIgnored(true)} className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`} title="Ignorar alertas desta semana">
            <EyeOff size={14}/>
         </button>
      </div>

      <div className="space-y-4">
        {notifications.excess.length > 0 && (
          <div className="space-y-2">
             <div className={`flex items-center justify-between text-[10px] font-black uppercase tracking-widest pb-1 border-b ${isDarkMode ? 'text-amber-400 border-amber-900/50' : 'text-amber-600 border-amber-200'}`}>
                <div className="flex items-center gap-1.5"><TrendingUp size={12}/> <span>Excesso ({notifications.excess.length})</span></div>
             </div>
             {notifications.excess.map((ex, i) => (
                <div key={`ex-${i}`} className={`p-2 rounded flex flex-col gap-0.5 text-xs font-bold leading-tight ${isDarkMode ? 'bg-amber-900/20 text-slate-300 border border-amber-900/30' : 'bg-amber-50 text-slate-700 border border-amber-100'}`}>
                   <span className="opacity-70 text-[8px] uppercase tracking-widest">{ex.className}</span>
                   <span>{ex.subject}</span>
                   <span className={`text-[9px] mt-0.5 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>Alocado: {ex.countAllocated} / Previsto: {ex.expected}</span>
                </div>
             ))}
          </div>
        )}

        {notifications.deficit.length > 0 && (
          <div className="space-y-2">
             <div className={`flex items-center justify-between text-[10px] font-black uppercase tracking-widest pb-1 border-b ${isDarkMode ? 'text-rose-400 border-rose-900/50' : 'text-rose-600 border-rose-200'}`}>
                <div className="flex items-center gap-1.5"><TrendingDown size={12}/> <span>Déficit ({notifications.deficit.length})</span></div>
             </div>
             {notifications.deficit.map((def, i) => (
                <div key={`def-${i}`} className={`p-2 rounded flex flex-col gap-0.5 text-xs font-bold leading-tight ${isDarkMode ? 'bg-rose-900/20 text-slate-300 border border-rose-900/30' : 'bg-rose-50 text-slate-700 border border-rose-100'}`}>
                   <span className="opacity-70 text-[8px] uppercase tracking-widest">{def.className}</span>
                   <span>{def.subject}</span>
                   <span className={`text-[9px] mt-0.5 ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>Alocado: {def.countAllocated} / Previsto: {def.expected}</span>
                </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
}
