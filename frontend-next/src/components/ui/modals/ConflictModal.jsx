import React from 'react';
import { Edit3, Check, X } from 'lucide-react';

export function ConflictModal({
  conflictModal,
  setConflictModal,
  isDarkMode,
  handleConflictResolve
}) {
  if (!conflictModal.show) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className={`rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-5 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
              <Edit3 size={18}/>
            </div>
            <h3 className={`text-lg font-bold uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              Análise de Alterações
            </h3>
          </div>
          <button onClick={() => setConflictModal({show:false})} className={`transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}>
            <X size={20}/>
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          <div className="space-y-2">
            {conflictModal.diffs.map((diff, i) => (
              <div key={i} className={`p-3 rounded-xl border flex flex-col gap-1 transition-all ${diff.type === 'NOVO' ? (isDarkMode ? 'bg-emerald-900/20 border-emerald-800/50 text-emerald-300' : 'bg-emerald-50 border-emerald-100 text-emerald-800') : diff.type === 'REMOVIDO' ? (isDarkMode ? 'bg-rose-900/20 border-rose-800/50 text-rose-300' : 'bg-rose-50 border-rose-100 text-rose-800') : (isDarkMode ? 'bg-amber-900/20 border-amber-800/50 text-amber-300' : 'bg-amber-50 border-amber-100 text-amber-800')}`}>
                <div className="flex items-center justify-between">
                  <span className="font-black text-[10px] tracking-widest uppercase opacity-60">{diff.type}</span>
                  <span className="font-bold text-xs">{diff.class}</span>
                </div>
                <span className="text-sm font-medium leading-relaxed">{diff.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={`p-5 border-t flex flex-col sm:flex-row justify-end gap-3 rounded-b-3xl ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
          <button onClick={() => setConflictModal({show:false})} className={`px-5 py-2.5 font-bold rounded-xl text-sm transition-colors ${isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>
            Cancelar
          </button>
          <button onClick={() => handleConflictResolve('merge')} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2">
            <Check size={16}/> Atualizar Mudanças
          </button>
          <button onClick={() => handleConflictResolve('replace')} className={`px-5 py-2.5 text-white rounded-xl font-bold text-sm transition-all ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-900 hover:bg-black'}`}>
            Substituir Tudo
          </button>
        </div>
      </div>
    </div>
  );
}
