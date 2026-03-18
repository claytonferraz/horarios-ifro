import React from "react";
import { Eye, BookOpen, Calendar } from "lucide-react";

export const AdminStatsPanel = ({ adminStats, isDarkMode }) => {
  if (!adminStats) return null;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className={`rounded-2xl shadow-sm border p-4 flex items-center gap-4 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-violet-900/40 text-violet-400' : 'bg-violet-100 text-violet-600'}`}>
          <Eye size={24} />
        </div>
        <div>
          <h3 className={`text-xl font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
            {adminStats.previa?.weeks || 0} <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Semanas</span>
          </h3>
          <p className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Prévia ({adminStats.previa?.classes || 0} aulas)
          </p>
        </div>
      </div>
      <div className={`rounded-2xl shadow-sm border p-4 flex items-center gap-4 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
          <BookOpen size={24} />
        </div>
        <div>
          <h3 className={`text-xl font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
            {adminStats.padrao?.weeks || 0} <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Semanas</span>
          </h3>
          <p className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Padrão Anual ({adminStats.padrao?.classes || 0} aulas)
          </p>
        </div>
      </div>
      <div className={`rounded-2xl shadow-sm border p-4 flex items-center gap-4 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
          <Calendar size={24} />
        </div>
        <div>
          <h3 className={`text-xl font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
            {adminStats.oficial?.weeks || 0} <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Semanas</span>
          </h3>
          <p className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Oficial ({adminStats.oficial?.classes || 0} aulas totais)
          </p>
        </div>
      </div>
    </div>
  );
};
