import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, ChevronDown, CheckCircle2, XCircle, Bell, Maximize2, Loader2, Send } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { resolveTeacherName } from '@/lib/dates';
import { io } from "socket.io-client";

export function FloatingRequestsWidget({ isDarkMode, userRole, appMode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loadingId, setLoadingId] = useState(null);
  
  const { globalTeachers } = useData();
  const { siape } = useAuth();
  
  const prevCountRef = useRef(0);
  const audioRef = useRef(typeof window !== 'undefined' ? new Audio('/notification.mp3') : null);

  const isAdmin = ['admin', 'gestao'].includes(userRole);
  const activeRole = userRole || appMode || 'aluno';

  const loadData = async () => {
    try {
      let fReqs = [];
      let fNotifs = [];

      if (isAdmin) {
        fReqs = await apiClient.fetchRequests() || [];
      }
      fNotifs = await apiClient.fetchNotifications(siape, activeRole) || [];
      
      setRequests(fReqs);
      setNotifications(fNotifs);
      
      const pendingCount = fReqs.filter(r => r.status === 'pendente' || r.status === 'pending').length;
      const unreadNotifs = fNotifs.filter(n => !n.read).length; // Backend doesn't support read yet, treat all as newly fetched if ID > last
      const totalNew = pendingCount + fNotifs.length;
      
      // Native Push Browser Alert if increased
      if (typeof window !== 'undefined' && totalNew > prevCountRef.current && prevCountRef.current > 0) {
         if (Notification.permission === 'granted') {
           new Notification("Novidades no Portal", { body: "Uma nova solicitação ou alteração de horário acabou de chegar." });
         }
         // Som suave (Opcional, ignorado se arquivo não existir ou autoplay bloquado)
         if (audioRef.current) audioRef.current.play().catch(e => {});
      }
      
      prevCountRef.current = totalNew;

    } catch (e) {
      console.error("Erro ao carregar avisos/widgets", e);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    if (appMode === 'home') return; // hide from completely public homepage

    loadData();

    // Socket Real-time
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3012');
    socket.on('schedule_updated', () => {
      loadData();
    });
    
    let interval;
    if (isOpen) {
      interval = setInterval(loadData, 30000); // Also poll just in case
    }

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [isOpen, userRole, appMode, siape]);

  // Hide entirely if it's external page and no notifications are actually present
  if (appMode === 'home') return null;
  // If student and 0 notifications, don't show the bubble
  if (!isAdmin && notifications.length === 0) return null;

  const pendingRequests = requests.filter(r => r.status === 'pendente' || r.status === 'pending');
  const resolvedRequests = requests.filter(r => r.status !== 'pendente' && r.status !== 'pending').slice(0, 10);
  
  // Mixed timeline Feed
  const feed = [
    ...notifications.map(n => ({...n, isNotif: true, time: new Date(n.createdAt).getTime()})),
    ...resolvedRequests.map(r => ({...r, isReq: true, time: new Date(r.createdAt).getTime()}))
  ].sort((a,b) => b.time - a.time).slice(0, 20);

  const handleUpdate = async (id, status, feedback) => {
    setLoadingId(id);
    try {
      await apiClient.updateRequestStatus(id, status, feedback);
      await loadData();
    } catch (e) {
      alert("Erro ao atualizar: " + e.message);
    } finally {
      setLoadingId(null);
    }
  };

  const bubbleCount = pendingRequests.length + (notifications.length > 0 ? 1 : 0);

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      {/* CHAT WINDOW */}
      <div className={`transition-all transform origin-bottom-right duration-300 ${isOpen ? 'scale-100 opacity-100 translate-y-0 mb-4' : 'scale-75 opacity-0 translate-y-10 pointer-events-none absolute bottom-full'}`}>
        <div className={`w-[360px] sm:w-[400px] h-[500px] max-h-[70vh] rounded-2xl shadow-2xl flex flex-col border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          
          {/* Header */}
          <div className={`px-4 py-3 flex items-center justify-between shadow-sm bg-gradient-to-r ${isAdmin ? 'from-rose-600 to-indigo-600' : 'from-indigo-600 to-emerald-600'}`}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                {isAdmin ? <MessageSquare size={16} className="text-white" /> : <Bell size={16} className="text-white" />}
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest leading-none">{isAdmin ? 'Central de Pedidos' : 'Notificações'}</h3>
                {isAdmin && <p className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-0.5">{pendingRequests.length} resoluções pendentes</p>}
                {!isAdmin && <p className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-0.5">Sempre atualizado</p>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isAdmin && (
                <button onClick={() => { setIsOpen(false); window.location.href = '/admin'; }} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-all cursor-pointer" title="Expandir no Painel">
                  <Maximize2 size={16} />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-all cursor-pointer">
                <ChevronDown size={20} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className={`flex-1 overflow-y-auto p-3 space-y-4 scroll-smooth ${isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50/50'}`}>
             
             {requests.length === 0 && notifications.length === 0 && (
               <div className="flex flex-col items-center justify-center h-full text-center opacity-50 space-y-3">
                 <CheckCircle2 size={40} className={isDarkMode ? 'text-slate-600' : 'text-slate-400'} />
                 <p className="text-[10px] font-black uppercase tracking-widest">Tudo tranquilo<br/>no momento</p>
               </div>
             )}

             {/* Pending First (Admins Only) */}
             {isAdmin && pendingRequests.map(req => (
               <ChatItem key={`req-${req.id}`} req={req} isDarkMode={isDarkMode} loadingId={loadingId} handleUpdate={handleUpdate} globalTeachers={globalTeachers} />
             ))}

             {/* Resolved/Alerts Separator */}
             {feed.length > 0 && pendingRequests.length > 0 && (
               <div className="flex items-center gap-2 py-2 opacity-30">
                 <div className="flex-1 border-t border-slate-400"></div>
                 <span className="text-[8px] font-black uppercase tracking-widest px-2">Histórico Recente</span>
                 <div className="flex-1 border-t border-slate-400"></div>
               </div>
             )}

             {/* Mixed Feed Array */}
             {feed.map(item => {
                if (item.isReq) {
                  return <ChatItem key={`hist-${item.id}`} req={item} isDarkMode={isDarkMode} loadingId={loadingId} handleUpdate={handleUpdate} globalTeachers={globalTeachers} />;
                } else if (item.isNotif) {
                  return <AlertItem key={`notif-${item.id}`} notif={item} isDarkMode={isDarkMode} />;
                }
             })}
          </div>

        </div>
      </div>

      {/* FLOATING BUTTON (FAB) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-14 h-14 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${isOpen ? (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-600') : (isAdmin ? 'bg-rose-600 text-white hover:bg-rose-500' : 'bg-indigo-600 text-white hover:bg-indigo-500')}`}
      >
        {isOpen ? <X size={24} /> : (isAdmin ? <MessageSquare size={24} /> : <Bell size={24} />)}
        
        {!isOpen && bubbleCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black ring-2 ring-white text-slate-900">
            {bubbleCount > 9 ? '9+' : bubbleCount}
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
  try {
    const p = JSON.parse(req.proposed_slot);
    desc = `Aula de ${p.subject} (${p.className}) solicitada para ${p.day} às ${p.time}.`;
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

function AlertItem({ notif, isDarkMode }) {
  const isPrevia = notif.type === 'previa' || notif.type === 'NEW_PREVIA';
  
  return (
    <div className={`flex flex-col text-[11px] font-medium leading-relaxed max-w-[90%] mx-auto w-full items-center`}>
      <span className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1">{notif.title || 'ALERTA DO SISTEMA'}</span>
      
      <div className={`w-full p-3 rounded-2xl shadow-sm border text-center ${isPrevia ? (isDarkMode ? 'bg-indigo-900/30 border-indigo-800/50 text-indigo-200' : 'bg-indigo-50 border-indigo-200 text-indigo-900') : (isDarkMode ? 'bg-amber-900/30 border-amber-800/50 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900')}`}>
        <Bell size={16} className={`mx-auto mb-2 opacity-70 ${isPrevia ? 'animate-pulse' : 'animate-bounce'}`} />
        <p className="font-bold">{notif.message}</p>
      </div>
      
      <span className="text-[8px] font-black uppercase tracking-widest opacity-40 mt-1">
        {new Date(notif.createdAt).toLocaleString([], {day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'})}
      </span>
    </div>
  );
}
