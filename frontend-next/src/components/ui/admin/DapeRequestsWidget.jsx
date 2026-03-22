import React from 'react';

export default function DapeRequestsWidget({ isOpen, setIsOpen, requests, onApprove, onReject, isDarkMode }) {
  if (!isOpen) return <button onClick={() => setIsOpen(true)} className="fixed bottom-24 right-6 p-4 rounded-full bg-emerald-600 text-white shadow-lg font-bold text-xs z-50 hover:scale-105 transition-transform flex items-center gap-2 group">
    <span>DAPE Homologações</span>
    {requests?.length > 0 && <span className="bg-red-500 rounded-full px-2 py-0.5">{requests?.length || 0}</span>}
  </button>;
  return (
    <div className={"fixed bottom-24 right-6 w-96 p-5 rounded-2xl shadow-2xl z-[9999] flex flex-col max-h-[70vh] animate-in slide-in-from-bottom-10 " + (isDarkMode ? 'bg-slate-800 border border-slate-700 text-white' : 'bg-white border border-slate-200 text-slate-900')}>
      <div className="flex justify-between items-center mb-4 border-b pb-2 border-slate-200 dark:border-slate-700 shrink-0">
        <h3 className="font-black uppercase tracking-widest text-sm text-emerald-500">Análise da DAPE</h3>
        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-rose-500 font-bold p-2 transition-colors">X</button>
      </div>
      <div className="overflow-y-auto flex-1 space-y-3 custom-scrollbar">
        {requests?.length === 0 && <p className="text-xs opacity-50 text-center py-8">Nenhuma solicitação pendente.</p>}
        {requests?.map(req => (
          <div key={req.id} className={"p-3 rounded-xl text-xs border transition-colors " + (isDarkMode ? 'bg-slate-900 border-slate-700 hover:border-slate-600' : 'bg-slate-50 border-slate-200 hover:border-emerald-200')}>
            <p><strong>Ação:</strong> <span className={req.action_type === 'vaga' ? 'text-rose-500' : 'text-indigo-500'}>{req.action_type === 'vaga' ? 'Reportou Aula Vaga' : 'Permuta Acordada'}</span></p>
            <p><strong>Turma:</strong> {req.target_class} ({req.original_day} às {req.original_time})</p>
            <p><strong>Motivo:</strong> {req.reason}</p>
            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => onReject(req)} className="flex-1 py-2 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded-lg hover:bg-rose-200 transition-colors font-black uppercase text-[9px] tracking-widest">Recusar</button>
              <button onClick={() => onApprove(req)} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg shadow-sm transition-colors hover:bg-emerald-500 font-black uppercase text-[9px] tracking-widest">Homologar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
