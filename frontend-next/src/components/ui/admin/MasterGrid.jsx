import React from 'react';
import { CalendarDays } from 'lucide-react';

export function MasterGrid({ isDarkMode, subjectHoursMeta, ...props }) {
  return (
    <div className={`p-6 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
       <div className="flex items-center gap-3 mb-6 border-b pb-4 border-slate-700/50">
          <CalendarDays className="text-emerald-500" size={24} />
          <h2 className="text-xl font-black uppercase tracking-widest">Master Grid - Quadro de Comando</h2>
       </div>
       <div className="p-10 border-2 border-dashed rounded-xl text-center border-slate-500/30">
           <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">
              Módulo de Drag-and-Drop Desacoplado com Sucesso.
           </p>
           <p className="text-slate-500 text-xs mt-2">
              Aguardando injeção da lógica de WebSockets e grade visual.
           </p>
       </div>
    </div>
  );
}
