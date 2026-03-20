import React, { useState, useEffect } from 'react';
import { MessageSquare, X, ChevronDown, CheckCircle2, XCircle, ChevronUp, Maximize2, Loader2, Send } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useData } from '@/contexts/DataContext';
import { resolveTeacherName } from '@/lib/dates';

export function FloatingRequestsWidget({ isDarkMode, userRole }) {
  const [isOpen, setIsOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loadingId, setLoadingId] = useState(null);
  const { globalTeachers } = useData();

  // Load only on mount and interval when open
  const loadRequests = async () => {
    try {
      const data = await apiClient.fetchRequests();
      setRequests(data || []);
    } catch (e) {
      console.error("Erro ao carregar solicitações no widget", e);
    }
  };

  useEffect(() => {
    if (!['admin', 'gestao'].includes(userRole)) return;
    loadRequests();
    
    // Auto-refresh when open
    let interval;
    if (isOpen) {
      interval = setInterval(loadRequests, 30000); // 30s polling
    }
    return () => clearInterval(interval);
  }, [isOpen, userRole]);

  if (!['admin', 'gestao'].includes(userRole)) return null;

  const pendingRequests = requests.filter(r => r.status === 'pendente' || r.status === 'pending');
  const resolvedRequests = requests.filter(r => r.status !== 'pendente' && r.status !== 'pending').slice(0, 10); // show last 10

  const handleUpdate = async (id, status, feedback) => {
    setLoadingId(id);
    try {
      await apiClient.updateRequestStatus(id, status, feedback);
      await loadRequests();
    } catch (e) {
      alert("Erro ao atualizar: " + e.message);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      {/* CHAT WINDOW */}
      <div className={`transition-all transform origin-bottom-right duration-300 ${isOpen ? 'scale-100 opacity-100 translate-y-0 mb-4' : 'scale-75 opacity-0 translate-y-10 pointer-events-none absolute bottom-full'}`}>
        <div className={`w-[360px] sm:w-[400px] h-[500px] max-h-[70vh] rounded-2xl shadow-2xl flex flex-col border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between shadow-sm bg-gradient-to-r from-rose-600 to-indigo-600">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <MessageSquare size={16} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest leading-none">Central de Pedidos</h3>
                <p className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-0.5">{pendingRequests.length} pendentes</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setIsOpen(false); window.location.href = '/admin'; }} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-all cursor-pointer" title="Expandir no Painel">
                <Maximize2 size={16} />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-all cursor-pointer">
                <ChevronDown size={20} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className={`flex-1 overflow-y-auto p-3 space-y-4 scroll-smooth ${isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50/50'}`}>
             
             {requests.length === 0 && (
               <div className="flex flex-col items-center justify-center h-full text-center opacity-50 space-y-3">
                 <CheckCircle2 size={40} className={isDarkMode ? 'text-slate-600' : 'text-slate-400'} />
                 <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma solicitação<br/>no momento</p>
               </div>
             )}

             {/* Pending First */}
             {pendingRequests.map(req => (
               <ChatItem key={req.id} req={req} isDarkMode={isDarkMode} loadingId={loadingId} handleUpdate={handleUpdate} globalTeachers={globalTeachers} />
             ))}

             {/* Resolved Separator */}
             {resolvedRequests.length > 0 && pendingRequests.length > 0 && (
               <div className="flex items-center gap-2 py-2 opacity-30">
                 <div className="flex-1 border-t border-slate-400"></div>
                 <span className="text-[8px] font-black uppercase tracking-widest px-2">Histórico Recente</span>
                 <div className="flex-1 border-t border-slate-400"></div>
               </div>
             )}

             {/* Resolved Later */}
             {resolvedRequests.map(req => (
               <ChatItem key={req.id} req={req} isDarkMode={isDarkMode} loadingId={loadingId} handleUpdate={handleUpdate} globalTeachers={globalTeachers} />
             ))}
          </div>

        </div>
      </div>

      {/* FLOATING BUTTON (FAB) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-14 h-14 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${isOpen ? (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-600') : 'bg-rose-600 text-white hover:bg-rose-500'}`}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        {!isOpen && pendingRequests.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-black ring-2 ring-white">
            {pendingRequests.length}
          </span>
        )}
      </button>
    </div>
  );
}

function ChatItem({ req, isDarkMode, loadingId, handleUpdate, globalTeachers }) {
  const teacherName = resolveTeacherName(req.siape, globalTeachers) || req.siape;
  const isPending = req.status === 'pendente' || req.status === 'pending';
  
  let desc = req.description;
  let hasObj = false;
  try {
    const o = JSON.parse(req.original_slot);
    const p = JSON.parse(req.proposed_slot);
    desc = `Aula de ${p.subject} (${p.className}) solicitada para ${p.day} às ${p.time}.`;
    hasObj = true;
  } catch(e) {}

  return (
    <div className={`flex flex-col text-[11px] font-medium leading-relaxed max-w-[90%] ${req.status === 'rejeitado' || req.status === 'rejected' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
      <span className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1 ml-2">{teacherName}</span>
      
      <div className={`p-3 rounded-2xl shadow-sm border ${isPending ? (isDarkMode ? 'bg-slate-800 border-slate-700 rounded-tl-sm' : 'bg-white border-slate-200 rounded-tl-sm') : req.status === 'aprovado' || req.status === 'approved' ? (isDarkMode ? 'bg-emerald-900/20 border-emerald-800/50 rounded-tr-sm' : 'bg-emerald-50 border-emerald-200 rounded-tl-sm') : (isDarkMode ? 'bg-slate-800/40 border-slate-700 rounded-tr-sm opacity-60' : 'bg-slate-100 border-slate-200 rounded-tr-sm opacity-60')}`}>
        <p className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>{desc}</p>
        
        {req.admin_feedback && !isPending && (
          <div className={`mt-2 p-2 rounded-lg text-xs italic ${isDarkMode ? 'bg-black/20 text-slate-400' : 'bg-black/5 text-slate-600'}`}>
            &quot;{req.admin_feedback}&quot;
          </div>
        )}

        {isPending && (
          <div className="mt-3 flex gap-2">
            <button 
              onClick={() => handleUpdate(req.id, 'aprovado', 'Aprovado via Chat')}
              disabled={loadingId === req.id}
              className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex justify-center items-center gap-1 transition-all"
            >
              {loadingId === req.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Aprovar
            </button>
            <button 
              onClick={() => handleUpdate(req.id, 'rejeitado', 'Inviável no momento')}
              disabled={loadingId === req.id}
              className="flex-1 py-1.5 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex justify-center items-center gap-1 transition-all"
            >
              <XCircle size={12} /> Rejeitar
            </button>
          </div>
        )}
      </div>
      
      <span className="text-[8px] font-black uppercase tracking-widest opacity-40 mt-1 ml-2">
        {new Date(req.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
      </span>
    </div>
  );
}
