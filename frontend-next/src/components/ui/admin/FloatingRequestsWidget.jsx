import React from 'react';

export default function FloatingRequestsWidget({ isOpen, setIsOpen, requests, onApprove, onReject, isDarkMode }) {
  if (!isOpen) return <button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 p-4 rounded-full bg-indigo-600 text-white shadow-lg font-bold text-xs z-50">Homologar Trocas ({requests?.length || 0})</button>;
  return (
    <div className={"fixed bottom-6 right-6 w-96 p-5 rounded-2xl shadow-2xl z-50 flex flex-col max-h-[80vh] " + (isDarkMode ? 'bg-slate-800 border border-slate-700 text-white' : 'bg-white border border-slate-200 text-slate-900')}>
      <div className="flex justify-between items-center mb-4 border-b pb-2 border-slate-200 dark:border-slate-700">
        <h3 className="font-black uppercase tracking-widest text-sm text-indigo-500">Análise da DAPE</h3>
        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-rose-500 font-bold">X</button>
      </div>
      <div className="overflow-y-auto flex-1 space-y-3">
        {requests?.length === 0 && <p className="text-xs opacity-50 text-center py-4">Nenhuma solicitação aguardando homologação.</p>}
        {requests?.map(req => (
          <div key={req.id} className={"p-3 rounded-xl text-xs border " + (isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200')}>
            <p><strong>Ação:</strong> <span className={req.action_type === 'vaga' ? 'text-rose-500' : 'text-indigo-500'}>{req.action_type === 'vaga' ? 'Reportou Aula Vaga' : 'Permuta Acordada'}</span></p>
            <p><strong>Turma:</strong> {req.target_class} ({req.original_day} às {req.original_time})</p>
            <p><strong>Motivo:</strong> {req.reason}</p>
            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => onReject(req)} className="flex-1 py-2 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded-lg hover:bg-rose-200 font-black uppercase text-[9px] tracking-widest">Recusar</button>
              <button onClick={() => onApprove(req)} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg shadow-sm hover:bg-emerald-500 font-black uppercase text-[9px] tracking-widest">Homologar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { FloatingRequestsWidget as NamedExportAlternative };
