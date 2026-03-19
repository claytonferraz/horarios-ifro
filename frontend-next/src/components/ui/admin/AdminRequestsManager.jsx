import React from 'react';
import { MessageSquare, CheckCircle2, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useData } from '@/contexts/DataContext';

export function AdminRequestsManager({ isDarkMode }) {
  const [requests, setRequests] = React.useState([]);
  const { globalTeachers } = useData();
  const [loadingId, setLoadingId] = React.useState(null);

  const loadAll = async () => {
    try {
      const data = await apiClient.fetchRequests();
      setRequests(data || []);
    } catch (e) {
      console.error("Erro ao carregar solicitações", e);
    }
  };

  React.useEffect(() => {
    loadAll();
  }, []);

  const handleUpdate = async (id, status, feedback) => {
    setLoadingId(id);
    try {
      await apiClient.updateRequestStatus(id, status, feedback);
      loadAll();
      // Emit trigger implicitly via backend save, but loadAll handles local view
    } catch (e) {
      alert("Erro ao atualizar: " + e.message);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl shadow-sm border overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`px-6 py-4 flex items-center justify-between border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex items-center gap-3">
             <MessageSquare size={18} className="text-rose-400" />
             <h2 className="font-black text-xs uppercase tracking-[0.2em]">Solicitações de Professores</h2>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {requests.length === 0 ? (
            <div className="text-center py-20 opacity-30">
               <MessageSquare size={48} className="mx-auto mb-4" />
               <p className="text-xs font-black uppercase tracking-widest">Nenhuma solicitação pendente no momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {requests.map(req => (
                <RequestCard 
                  key={req.id} 
                  req={req} 
                  isDarkMode={isDarkMode} 
                  loadingId={loadingId} 
                  handleUpdate={handleUpdate} 
                  globalTeachers={globalTeachers} 
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RequestCard({ req, isDarkMode, loadingId, handleUpdate, globalTeachers }) {
  const teacherName = globalTeachers.find(t => t.siape === req.siape)?.nome_exibicao || req.siape;
  const [feedback, setFeedback] = React.useState(req.admin_feedback || '');

  return (
    <div className={`p-5 rounded-2xl border transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black text-sm">
                {teacherName.charAt(0)}
              </div>
              <div>
                 <p className={`text-xs font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{teacherName}</p>
                 <p className="text-[10px] font-bold text-slate-500">SIAPE: {req.siape}</p>
              </div>
            </div>
            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
              req.status === 'pendente' ? (isDarkMode ? 'bg-amber-900/30 text-amber-500' : 'bg-amber-50 text-amber-600') :
              req.status === 'aprovado' ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-500' : 'bg-emerald-50 text-emerald-600') :
              (isDarkMode ? 'bg-rose-900/30 text-rose-500' : 'bg-rose-50 text-rose-600')
            }`}>
              {req.status}
            </span>
          </div>

          <div className={`p-4 rounded-xl text-xs font-medium leading-relaxed ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-700'}`}>
             <p className="font-bold uppercase text-[9px] text-slate-500 mb-1 tracking-widest">Pedido:</p>
             {req.description}
          </div>

          {(req.original_slot || req.proposed_slot) && (
            <div className="grid grid-cols-2 gap-3">
               <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Original</p>
                  <p className="text-xs font-bold">{req.original_slot}</p>
               </div>
               <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-indigo-900/10 border-indigo-900/30' : 'bg-indigo-50 border-indigo-100'}`}>
                  <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-1">Proposta</p>
                  <p className="text-xs font-bold text-indigo-600">{req.proposed_slot}</p>
               </div>
            </div>
          )}
          <p className="text-[9px] font-bold text-slate-500 uppercase">Semana Alvo: {req.week_id}</p>
        </div>

        <div className={`w-full lg:w-72 lg:border-l lg:pl-6 space-y-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
           <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Ação / Resposta</label>
              <textarea 
                placeholder="Feedback para o professor..."
                className={`w-full min-h-[80px] p-3 rounded-xl border text-[11px] font-bold outline-none resize-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}`}
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
              />
           </div>
           <div className="grid grid-cols-2 gap-2">
              <button 
                disabled={loadingId === req.id}
                onClick={() => handleUpdate(req.id, 'aprovado', feedback)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-emerald-600 hover:bg-emerald-700'} text-white shadow-lg shadow-emerald-900/20 active:scale-95`}
              >
                <CheckCircle2 size={14} /> Aprovar
              </button>
              <button 
                disabled={loadingId === req.id}
                onClick={() => handleUpdate(req.id, 'rejeitado', feedback)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-rose-600 hover:bg-rose-500' : 'bg-rose-600 hover:bg-rose-700'} text-white shadow-lg shadow-rose-900/20 active:scale-95`}
              >
                <XCircle size={14} /> Rejeitar
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
