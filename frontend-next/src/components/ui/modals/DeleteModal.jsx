import React from 'react';
import { Trash2 } from 'lucide-react';

export function DeleteModal({
  deleteModal,
  setDeleteModal,
  isDarkMode,
  confirmDeletion
}) {
  if (!deleteModal.show) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className={`rounded-3xl w-full max-w-sm shadow-2xl border p-6 text-center space-y-5 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-3 rounded-full w-16 h-16 mx-auto flex items-center justify-center ${isDarkMode ? 'bg-rose-900/30 text-rose-400' : 'bg-rose-100 text-rose-600'}`}>
          <Trash2 size={32} />
        </div>
        <div className="space-y-2">
          <h3 className={`text-xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Confirmar Exclusão
          </h3>
          <p className={`text-sm font-medium leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Deseja apagar permanentemente os dados da semana: <br/>
            <strong className={`font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{deleteModal.visualName}</strong>?
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={() => setDeleteModal({ show: false, weekKey: '', visualName: '' })} className={`flex-1 px-5 py-2.5 text-sm font-black rounded-xl transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Cancelar
          </button>
          <button onClick={confirmDeletion} className="flex-1 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-black rounded-xl shadow-md transition-all">
            Sim, Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
