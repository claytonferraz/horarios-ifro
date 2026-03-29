import React from 'react';
import { BarChart3, Clock, Printer, Calendar, Search } from 'lucide-react';
import { SearchableSelect } from '../SearchableSelect';
import { resolveTeacherName } from '@/lib/dates';

export function AdminTotalControl({
  isDarkMode,
  diarioStats,
  finalFilteredTotalData,
  bimestresData,
  availableYearsForTotal, totalFilterYear, setTotalFilterYear,
  availableTeachersForTotal, totalFilterTeacher, setTotalFilterTeacher,
  availableClassesForTotal, totalFilterClass, setTotalFilterClass,
  availableSubjectsForTotal, totalFilterSubject, setTotalFilterSubject,
  globalTeachers,
  bimesters,
  academicWeeks,
  handlePrint,
  hideTeacherFilter = false
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* SEÇÃO DE FILTROS (REUTILIZADA) */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-2xl border shadow-sm no-print ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
        <div className="space-y-1">
          <label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1 block">Ano Letivo</label>
          <SearchableSelect 
            isDarkMode={isDarkMode} 
            options={availableYearsForTotal} 
            value={totalFilterYear} 
            onChange={setTotalFilterYear} 
            colorClass={isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-sm' : 'bg-white border-slate-200 text-slate-800 shadow-sm'} 
          />
        </div>

        {!hideTeacherFilter && (
          <div className="space-y-1">
            <label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1 block">Professor</label>
            <SearchableSelect 
              isDarkMode={isDarkMode} 
              options={availableTeachersForTotal
                .map(t => ({value: t, label: resolveTeacherName(t, globalTeachers)}))
                .sort((a,b) => String(a.label).localeCompare(String(b.label)))} 
              value={totalFilterTeacher} 
              onChange={setTotalFilterTeacher} 
              colorClass={isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-sm' : 'bg-white border-slate-200 text-slate-800 shadow-sm'} 
            />
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1 block">Turma</label>
          <SearchableSelect 
            isDarkMode={isDarkMode} 
            options={availableClassesForTotal} 
            value={totalFilterClass} 
            onChange={setTotalFilterClass} 
            colorClass={isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-sm' : 'bg-white border-slate-200 text-slate-800 shadow-sm'} 
          />
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1 block">Disciplina</label>
          <SearchableSelect 
            isDarkMode={isDarkMode} 
            options={availableSubjectsForTotal.map(s => ({ value: s, label: s }))} 
            value={totalFilterSubject} 
            onChange={setTotalFilterSubject} 
            colorClass={isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-sm' : 'bg-white border-slate-200 text-slate-800 shadow-sm'} 
          />
        </div>
      </div>

      <div className={`rounded-2xl shadow-sm border p-4 sm:p-6 flex flex-col xl:flex-row items-center justify-between gap-4 bg-gradient-to-br ${isDarkMode ? 'bg-slate-800 border-slate-700 from-slate-800 to-slate-900' : 'bg-white border-slate-200 from-white to-slate-50/50'}`}>
        
        <div className="flex items-center gap-4 w-full xl:w-auto">
          <div className={`p-4 rounded-2xl text-white shadow-xl rotate-2 shrink-0 ${isDarkMode ? 'bg-amber-700 shadow-none' : 'bg-amber-600 shadow-amber-200'}`}><BarChart3 size={32}/></div>
          <div>
            <h2 className={`text-xl sm:text-2xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>Controle de aulas</h2>
            <p className={`font-bold uppercase text-[9px] tracking-widest mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Visão geral oficial</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 w-full xl:w-auto">
          <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <span className={`text-xl font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{finalFilteredTotalData.length}</span>
            <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 text-center ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Aulas Totais</span>
          </div>

          <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center ${isDarkMode ? 'bg-blue-900/10 border-blue-800/30' : 'bg-blue-50/50 border-blue-100'}`}>
            <span className={`text-xl font-black ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{diarioStats.chTotal}</span>
            <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 text-center opacity-80 ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>CH Total</span>
          </div>
          
          <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center ${isDarkMode ? 'bg-indigo-900/10 border-indigo-800/30' : 'bg-indigo-50/50 border-indigo-100'}`}>
            <span className={`text-xl font-black ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{diarioStats.ministradas}</span>
            <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 text-center opacity-80 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>CH Ministrada</span>
          </div>

          <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center 
            ${diarioStats.status === 'atrasada' ? (isDarkMode ? 'bg-rose-900/20 border-rose-800/50' : 'bg-rose-50 border-rose-200') : 
              diarioStats.status === 'adiantada' ? (isDarkMode ? 'bg-teal-900/20 border-teal-800/50' : 'bg-teal-50 border-teal-200') : 
              diarioStats.status === 'em_dia' ? (isDarkMode ? 'bg-emerald-900/20 border-emerald-800/50' : 'bg-emerald-50 border-emerald-200') : 
              (isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200')}`}>
            <span className={`text-xl font-black 
              ${diarioStats.status === 'atrasada' ? (isDarkMode ? 'text-rose-400' : 'text-rose-600') : 
                diarioStats.status === 'adiantada' ? (isDarkMode ? 'text-teal-400' : 'text-teal-600') : 
                diarioStats.status === 'em_dia' ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600') : 
                (isDarkMode ? 'text-slate-500' : 'text-slate-400')}`}>
              {diarioStats.status === 'indefinido' ? '-' : diarioStats.status === 'em_dia' ? 'OK' : `${diarioStats.status === 'atrasada' ? '-' : '+'}${diarioStats.diffAbs}`}
            </span>
            <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 text-center opacity-80 
              ${diarioStats.status === 'atrasada' ? (isDarkMode ? 'text-rose-400' : 'text-rose-700') : 
                diarioStats.status === 'adiantada' ? (isDarkMode ? 'text-teal-400' : 'text-teal-700') : 
                diarioStats.status === 'em_dia' ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-700') : 
                (isDarkMode ? 'text-slate-500' : 'text-slate-500')}`}>
              {diarioStats.status === 'indefinido' ? 'Sem CH' : diarioStats.status === 'em_dia' ? 'Em Dia' : diarioStats.status === 'atrasada' ? 'Atrasada' : 'Adiantada'}
            </span>
          </div>

          <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center ${isDarkMode ? 'bg-purple-900/10 border-purple-800/30' : 'bg-purple-50/50 border-purple-100'}`}>
            <span className={`text-xl font-black ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>{diarioStats.suapTotal}</span>
            <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 text-center opacity-80 ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>No SUAP</span>
          </div>

          <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center ${diarioStats.aLancar > 0 ? (isDarkMode ? 'bg-rose-900/20 border-rose-800/50' : 'bg-rose-50 border-rose-200') : (isDarkMode ? 'bg-emerald-900/20 border-emerald-800/50' : 'bg-emerald-50 border-emerald-200')}`}>
            <span className={`text-xl font-black ${diarioStats.aLancar > 0 ? (isDarkMode ? 'text-rose-400' : 'text-rose-600') : (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')}`}>
              {diarioStats.aLancar > 0 ? `+${diarioStats.aLancar}` : diarioStats.aLancar}
            </span>
            <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 text-center opacity-80 ${diarioStats.aLancar > 0 ? (isDarkMode ? 'text-rose-400' : 'text-rose-700') : (isDarkMode ? 'text-emerald-400' : 'text-emerald-700')}`}>A Lançar</span>
          </div>
        </div>
      </div>

      <div className={`rounded-2xl shadow-sm border overflow-hidden print:shadow-none print:border-none print:bg-white ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
         <div className={`text-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b no-print ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 border-slate-800'}`}>
           <div className="flex items-center gap-2.5">
             <Clock className="text-amber-500" size={20}/>
             <h3 className="font-black uppercase tracking-widest text-xs">Diário Detalhado</h3>
           </div>
           <div className="flex items-center gap-3">
             <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">Distribuição por bimestre</span>
             <button onClick={handlePrint} className="hidden md:flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-[10px] font-black transition-all shadow-sm">
               <Printer size={14} /> Imprimir Diário
             </button>
           </div>
         </div>
         <div className="p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 print:grid-cols-2 print:gap-2 print:p-0">
           {(() => {
              const bimsUI = (bimesters && bimesters.length > 0) ? bimesters.map((b, i) => {
                const fmtData = (iso) => iso ? iso.split('-').reverse().slice(0,2).join('/') : '';
                let diasLetivos = 0;
                const bStart = new Date(b.startDate + 'T00:00:00');
                const bEnd = new Date(b.endDate + 'T23:59:59');
                
                if (academicWeeks) {
                  academicWeeks.forEach(w => {
                    const wStart = new Date(w.start_date + 'T12:00:00');
                    const wEnd = new Date(w.end_date + 'T12:00:00');
                    if (wStart <= bEnd && wEnd >= bStart) {
                      const overlapStart = new Date(Math.max(wStart.getTime(), bStart.getTime()));
                      const overlapEnd = new Date(Math.min(wEnd.getTime(), bEnd.getTime()));
                      let overlapDays = 0;
                      for (let d = new Date(overlapStart); d <= overlapEnd; d.setDate(d.getDate() + 1)) {
                          if (d.getDay() !== 0) overlapDays++; 
                      }
                      
                      if (wStart >= bStart && wEnd <= bEnd && w.school_days > 0) {
                          diasLetivos += w.school_days;
                      } else if (w.school_days > 0) {
                          diasLetivos += Math.min(overlapDays, w.school_days);
                      } else {
                          diasLetivos += overlapDays; 
                      }
                    }
                  });
                }
                
                return {
                  b: i + 1,
                  name: b.name || `${i + 1}º Bimestre`,
                  d: fmtData(b.startDate) + ' a ' + fmtData(b.endDate),
                  start: fmtData(b.startDate),
                  diasLetivos
                };
              }) : [
                {b:1, name:'1º Bimestre', start: "04/02", diasLetivos: 0},
                {b:2, name:'2º Bimestre', start: "22/04", diasLetivos: 0},
                {b:3, name:'3º Bimestre', start: "22/07", diasLetivos: 0},
                {b:4, name:'4º Bimestre', start: "29/09", diasLetivos: 0}
              ];
              
              while (bimsUI.length < 4) bimsUI.push({ b: bimsUI.length + 1, name: `${bimsUI.length + 1}º Bimestre`, start: "-", diasLetivos: 0 });
              
              return bimsUI.slice(0,4).map(bim => (
                <div key={bim.b} className={`rounded-xl border shadow-sm print:break-inside-avoid print:shadow-none print:border-slate-300 print:bg-white flex flex-col ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`p-4 border-b flex flex-col gap-3 print:p-2 print:border-slate-300 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                    <div>
                      <h4 className={`font-black text-sm uppercase tracking-wider print:text-black ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>{bim.name}</h4>
                      <p className="text-[10px] uppercase tracking-widest mt-1 opacity-70 print:text-black print:opacity-100">
                        Início: <b className="text-emerald-500 print:text-black mr-2">{bim.start}</b> | 
                        Dias Letivos: <b className="text-emerald-500 print:text-black">{bim.diasLetivos}</b>
                      </p>
                    </div>
                    <div className={`text-white px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-widest shadow-sm flex items-center justify-between print:text-black print:bg-slate-100 print:shadow-none print:border border-slate-300 ${isDarkMode ? 'bg-indigo-600' : 'bg-indigo-600'}`}>
                      <span className="text-[8px] opacity-80 print:opacity-100">Aulas Contabilizadas</span>
                      <span className="text-sm print:font-black">{String((bimestresData[bim.b] || []).length).padStart(2, '0')}</span>
                    </div>
                  </div>
                  
                  <div className="p-2 md:p-3 flex flex-col gap-1 flex-1 print:p-2">
                    {(bimestresData[bim.b] && bimestresData[bim.b].length > 0) ? bimestresData[bim.b].map(r => (
                        <div key={r.id} className={`text-[10px] font-semibold py-1 border-b border-slate-500/10 last:border-0 hover:bg-slate-500/5 px-1 rounded transition-colors print:text-black print:border-slate-300 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                           {r.date} - {r.time.replace(' - ', ' ')} - <span className="uppercase">{r.subject}</span> {r.className && <span className="opacity-60 ml-1 print:opacity-100">({r.className})</span>}
                        </div>
                    )) : (
                        <div className="col-span-full text-center py-8 opacity-40 flex flex-col items-center justify-center gap-2 select-none no-print">
                          <Calendar size={24} />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sem Aulas Registradas Neste Bimestre</span>
                        </div>
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
    </div>
  );
}
