import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MessageSquare, X, ChevronDown, CheckCircle2, XCircle, Bell, Maximize2, Loader2, Send, CalendarDays, RefreshCcw } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { resolveTeacherName } from '@/lib/dates';
import { getSocketClient } from '@/lib/socketClient';

const PENDING_REQUEST_STATUSES = new Set(['pendente', 'pending', 'pronto_para_homologacao', 'aguardando_colega']);

const toTimestamp = (value) => {
  const ts = new Date(value || 0).getTime();
  return Number.isFinite(ts) ? ts : 0;
};

const normalizeStatus = (status) => String(status || '').toLowerCase().trim();

export function FloatingRequestsWidget({ isDarkMode, userRole, appMode, controlledIsOpen, setControlledIsOpen, hideButton }) {
  const [localIsOpen, setLocalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : localIsOpen;
  const setIsOpen = setControlledIsOpen !== undefined ? setControlledIsOpen : setLocalIsOpen;

  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loadingId, setLoadingId] = useState(null);
  
  const { globalTeachers, rawData } = useData();
  const { siape } = useAuth();
  
  const prevCountRef = useRef(0);
  const audioRef = useRef(typeof window !== 'undefined' ? new Audio('/notification.mp3') : null);

  const isAdmin = ['admin', 'gestao'].includes(userRole);
  const activeRole = userRole || appMode || 'aluno';
  const [feedFilter, setFeedFilter] = useState('todos');
  const readStorageKey = useMemo(() => `floating_feed_read_v2_${siape || 'anon'}_${activeRole}`, [siape, activeRole]);
  const [readMap, setReadMap] = useState({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(readStorageKey);
      setReadMap(raw ? JSON.parse(raw) : {});
    } catch (_) {
      setReadMap({});
    }
  }, [readStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(readStorageKey, JSON.stringify(readMap));
  }, [readMap, readStorageKey]);

  const loadData = React.useCallback(async () => {
    try {
      let fReqs = [];
      let fNotifs = [];

      if (isAdmin) {
        fReqs = await apiClient.fetchRequests() || [];
      } else if (appMode === 'professor' || userRole === 'professor') {
        fReqs = await apiClient.fetchRequests(siape) || [];
      }
      fNotifs = await apiClient.fetchNotifications(siape, activeRole) || [];
      
      setRequests(fReqs);
      setNotifications(fNotifs);
      
      const latestRequestTs = fReqs.reduce((acc, req) => Math.max(acc, toTimestamp(req.updated_at || req.created_at || req.createdAt)), 0);
      const latestNotifTs = fNotifs.reduce((acc, notif) => Math.max(acc, toTimestamp(notif.createdAt || notif.created_at)), 0);
      const latestItemTs = Math.max(latestRequestTs, latestNotifTs);
      
      // Native Push Browser Alert if increased
      if (typeof window !== 'undefined' && latestItemTs > prevCountRef.current && prevCountRef.current > 0) {
         if ('Notification' in window && Notification.permission === 'granted') {
           if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
             navigator.serviceWorker.ready.then(reg => {
               reg.showNotification("Novidades no Portal", { 
                 body: "Uma nova solicitação ou alteração de horário acabou de chegar.",
                 icon: "/icon-192x192.png"
               });
             }).catch(e => {
               try { new Notification("Novidades no Portal", { body: "Nova solicitação ou alteração de horário." }); } catch(err){}
             });
           } else {
             try { new Notification("Novidades no Portal", { body: "Nova solicitação ou alteração de horário." }); } catch(err){}
           }
         }
         // Som suave (Opcional, ignorado se arquivo não existir ou autoplay bloquado)
         if (audioRef.current) audioRef.current.play().catch(e => {});
      }
      
      prevCountRef.current = latestItemTs;

    } catch (e) {
      console.error("Erro ao carregar avisos/widgets", e);
    }
  }, [isAdmin, appMode, userRole, siape, activeRole]);

  useEffect(() => {
    
    if (appMode === 'home') return; // hide from completely public homepage

    loadData();

    const socket = getSocketClient();
    const onScheduleUpdated = () => {
      loadData();
    };
    socket.on('schedule_updated', onScheduleUpdated);
    
    let interval;
    if (isOpen) {
      interval = setInterval(loadData, 30000); // Also poll just in case
    }

    return () => {
      socket.off('schedule_updated', onScheduleUpdated);
      clearInterval(interval);
    };
  }, [isOpen, userRole, appMode, siape, loadData]);

  // Hide entirely if it's external page and no notifications are actually present
  if (appMode === 'home') return null;
  // If non-admin and no items at all, don't show the bubble
  if (!isAdmin && requests.length === 0 && notifications.length === 0) return null;

  const pendingRequests = requests.filter(r => PENDING_REQUEST_STATUSES.has(normalizeStatus(r.status)));

  const requestFeed = requests.map((req) => {
    const status = normalizeStatus(req.status);
    const actionType = String(req.action_type || 'geral').toLowerCase();
    return {
      kind: 'request',
      id: req.id,
      data: req,
      time: toTimestamp(req.updated_at || req.created_at || req.createdAt),
      filterKey: `request:${actionType}`,
      filterLabel: `Solicitação: ${actionType.replace(/_/g, ' ')}`,
      isPending: PENDING_REQUEST_STATUSES.has(status),
    };
  });

  const notifFeed = notifications.map((notif) => {
    const notifType = String(notif.type || 'sistema').toLowerCase();
    return {
      kind: 'notification',
      id: notif.id,
      data: notif,
      time: toTimestamp(notif.createdAt || notif.created_at),
      filterKey: `notification:${notifType}`,
      filterLabel: `Notificação: ${notifType.replace(/_/g, ' ')}`,
      isPending: false,
    };
  });

  const fullFeed = [...requestFeed, ...notifFeed]
    .sort((a, b) => b.time - a.time)
    .slice(0, 60);

  const filterOptionsMap = new Map([
    ['todos', 'Tudo'],
    ['nao_lidas', 'Não lidas'],
    ['pendentes', 'Solicitações pendentes'],
  ]);
  fullFeed.forEach((item) => {
    if (!filterOptionsMap.has(item.filterKey)) filterOptionsMap.set(item.filterKey, item.filterLabel);
  });
  const filterOptions = Array.from(filterOptionsMap.entries()).map(([value, label]) => ({ value, label }));

  const getReadKey = (item) => `${item.kind}:${item.id}`;
  const isItemRead = (item) => {
    // Para notificações, prioriza o que vem do banco (idRead === 1)
    if (item.kind === 'notification' && item.data.isRead) return true;
    return Boolean(readMap[getReadKey(item)]);
  };

  const visibleFeed = fullFeed.filter((item) => {
    if (feedFilter === 'todos') return true;
    if (feedFilter === 'nao_lidas') return !isItemRead(item);
    if (feedFilter === 'pendentes') return item.kind === 'request' && item.isPending;
    return item.filterKey === feedFilter;
  });

  const unreadCount = fullFeed.filter((item) => !isItemRead(item)).length;
  const bubbleCount = unreadCount;

  const toggleReadState = async (item) => {
    const key = getReadKey(item);
    const newState = !isItemRead(item);
    
    // Atualiza localmente imediato
    setReadMap((prev) => ({ ...prev, [key]: newState }));

    // Persiste no banco se for notificação e estiver marcando como lido
    if (item.kind === 'notification' && newState) {
      try {
        await apiClient.markNotificationsRead([item.id]);
      } catch(e) { console.error("Erro ao persistir leitura", e); }
    }
  };

  const markVisibleAsRead = async () => {
    if (visibleFeed.length === 0) return;
    
    const notificationIds = visibleFeed
      .filter(item => item.kind === 'notification' && !isItemRead(item))
      .map(item => item.id);

    setReadMap((prev) => {
      const next = { ...prev };
      visibleFeed.forEach((item) => {
        next[getReadKey(item)] = true;
      });
      return next;
    });

    if (notificationIds.length > 0) {
      try {
        await apiClient.markNotificationsRead(notificationIds);
      } catch(e) { console.error("Erro ao persistir leitura em lote", e); }
    }
  };

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

  const toggleOpen = () => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="flex flex-col items-end print:hidden relative">
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
             <div className={`sticky top-0 z-10 p-2 rounded-xl border backdrop-blur-sm flex items-center gap-2 ${isDarkMode ? 'bg-slate-900/90 border-slate-700' : 'bg-white/90 border-slate-200'}`}>
                <select
                  value={feedFilter}
                  onChange={(e) => setFeedFilter(e.target.value)}
                  className={`flex-1 px-2 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest outline-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
                >
                  {filterOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={markVisibleAsRead}
                  className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-colors ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                  title="Marcar itens visíveis como lidos"
                >
                  Marcar lidas
                </button>
             </div>
             
             {visibleFeed.length === 0 && (
               <div className="flex flex-col items-center justify-center h-full text-center opacity-50 space-y-3">
                 <CheckCircle2 size={40} className={isDarkMode ? 'text-slate-600' : 'text-slate-400'} />
                 <p className="text-[10px] font-black uppercase tracking-widest">Sem itens neste filtro</p>
               </div>
             )}

             {/* Timeline (cronológica) */}
             {visibleFeed.map((item) => {
                const read = isItemRead(item);
                if (item.kind === 'request') {
                  return (
                    <ChatItem
                      key={`req-${item.id}`}
                      req={item.data}
                      isDarkMode={isDarkMode}
                       isAdmin={isAdmin}
                      loadingId={loadingId}
                      handleUpdate={handleUpdate}
                      globalTeachers={globalTeachers}
                      rawData={rawData}
                      isRead={read}
                      onToggleRead={() => toggleReadState(item)}
                    />
                  );
                }
                if (item.kind === 'notification') {
                  return (
                    <AlertItem
                      key={`notif-${item.id}`}
                      notif={item.data}
                      isDarkMode={isDarkMode}
                       isAdmin={isAdmin}
                      isRead={read}
                      onToggleRead={() => toggleReadState(item)}
                    />
                  );
                }
                return null;
             })}
          </div>

        </div>
      </div>

      {/* FLOATING BUTTON (FAB) */}
      {!hideButton && (
        <button 
          onClick={toggleOpen}
          className={`relative w-14 h-14 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${isOpen ? (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-600') : (isAdmin ? 'bg-rose-600 text-white hover:bg-rose-500' : 'bg-indigo-600 text-white hover:bg-indigo-500')}`}
        >
          {isOpen ? <X size={24} /> : (isAdmin ? <MessageSquare size={24} /> : <Bell size={24} />)}
          
          {!isOpen && bubbleCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black ring-2 ring-white text-slate-900">
              {bubbleCount > 9 ? '9+' : bubbleCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

function ChatItem({ req, isDarkMode, isAdmin, loadingId, handleUpdate, globalTeachers, rawData = [], isRead, onToggleRead }) {
  const [isRejecting, setIsRejecting] = useState(false);
  const teacherSiape = req.requester_id || req.siape;
  const teacherName = resolveTeacherName(teacherSiape, globalTeachers) || teacherSiape;
  const isPending = PENDING_REQUEST_STATUSES.has(normalizeStatus(req.status));
  
  const resolveLabel = (slot) => {
      let subj = slot.subject || slot.classType || '';
      let clName = slot.className || slot.classId || '';
      
      // Busca no rawData para traduzir classId (ex: 4jpcexp1m) em "Nome Oculto" ou "3o Ano Inf"
      if (clName && clName.length > 5 && rawData.length > 0) {
         const match = rawData.find(r => r.className === clName || r.classId === clName || String(r.id) === String(clName));
         if (match) {
             clName = `${match.course || ''} ${match.className || ''}`.trim() || clName;
         }
      }
      return `${subj} - ${clName}`.replace(/^ - | - $/g, '');
  };
  
  let descUI = <p className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>{req.description || req.reason}</p>;
  try {
    let pO = req.original_slot;
    let pP = req.proposed_slot;
    if (typeof pO === 'string') { pO = JSON.parse(pO); if (typeof pO === 'string') pO = JSON.parse(pO); }
    if (typeof pP === 'string') { pP = JSON.parse(pP); if (typeof pP === 'string') pP = JSON.parse(pP); }
    
    if (pO && pP && req.action_type === 'troca') {
       descUI = (
         <div className="flex flex-col gap-2">
           <div className={`p-2 rounded border text-[10px] uppercase font-bold tracking-widest leading-tight ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
              <span className="opacity-50 block mb-1 text-[8px]">AULA ALVO SOLICITADA</span>
              <span className="text-indigo-500 block">{resolveLabel(pP)}</span>
              <span className="opacity-80 text-[8px]">{pP.day} às {pP.time} <span title="Colega Solicitado" className='underline'>{resolveTeacherName(req.substitute_id, globalTeachers)?.split(' ')[0]}</span></span>
           </div>
           <div className={`p-2 rounded border text-[10px] uppercase font-bold tracking-widest leading-tight ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
              <span className="opacity-50 block mb-1 text-[8px]">HORÁRIO CEDIDO P/ TROCA</span>
              <span className="text-rose-500 block">{resolveLabel(pO)}</span>
              <span className="opacity-80 text-[8px]">{pO.day} às {pO.time} <span title="Solicitante" className='underline'>{resolveTeacherName(req.requester_id, globalTeachers)?.split(' ')[0]}</span></span>
           </div>
         </div>
       );
    } else if (pP && req.action_type === 'oferta_vaga') {
        const subj = pP.subject || pP.targetSubject || req.subject || 'Aula';
        const clName = pP.className || pP.classId || req.target_class || '';
        const day = pP.day || pP.originalDay || req.original_day || '';
        const time = pP.time || pP.originalTime || req.original_time || '';
        const course = pP.course || '';
        descUI = (
          <p className={`leading-relaxed font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
            {`Mudança de ${subj}${course ? ' - ' + course : ''} ${clName} para ${day} às ${time}, PARA AULA VAGA`}
          </p>
        );
    } else if (pP) {
        const labelText = resolveLabel(pP);
        descUI = <p className={`leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{`Mudança / Vaga: ${labelText} para ${pP.day || pP.originalDay || ''} às ${pP.time || pP.originalTime || ''}.`}</p>;
    }
  } catch(e) {}

  return (
    <div className={`flex flex-col text-[11px] font-medium leading-relaxed max-w-[95%] w-full items-start mx-auto mb-2 ${isRead ? 'opacity-70' : ''}`}>
      <div className="w-full flex items-center justify-between mb-1 px-2">
        <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Solicitação de Troca - {teacherName}</span>
        <button
          onClick={onToggleRead}
          className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border transition-colors ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}
        >
          {isRead ? 'Não lida' : 'Marcar lida'}
        </button>
      </div>
      
      <div className={`w-full p-3 rounded-2xl shadow-sm border flex gap-3 ${isPending ? (isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200') : req.status === 'aprovado' || req.status === 'approved' ? (isDarkMode ? 'bg-emerald-900/30 border-emerald-800/50' : 'bg-emerald-50 border-emerald-200') : (isDarkMode ? 'bg-rose-900/10 border-rose-800/30 opacity-70' : 'bg-slate-50 border-slate-200 opacity-70')}`}>
        <div className={`p-2 rounded-full shrink-0 flex items-center justify-center self-start shadow-inner ${isDarkMode ? 'bg-indigo-900/50 border border-indigo-500/30' : 'bg-indigo-100/80 border border-indigo-200/50'}`}>
           <RefreshCcw size={20} className={isDarkMode ? 'text-indigo-300' : 'text-indigo-600'} />
        </div>
        
        <div className="flex-1 flex flex-col justify-center gap-2">
            {descUI}
            
            {req.admin_feedback && !isPending && (
              <div className={`p-2 rounded-lg text-xs italic ${isDarkMode ? 'bg-black/20 text-slate-400' : 'bg-black/5 text-slate-600'}`}>
                &quot;{req.admin_feedback}&quot;
              </div>
            )}

            {!isPending && (req.status === 'aprovado' || req.status === 'approved') && (
              <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-emerald-500/30 ${isDarkMode ? 'text-emerald-400 bg-emerald-500/10' : 'text-emerald-700 bg-emerald-100'}`}>
                 Aprovado pelo Gestor {resolveTeacherName(req.approved_by, globalTeachers) || 'DAPE'} em: {new Date(req.updated_at || req.created_at || req.createdAt).toLocaleString()}
              </div>
            )}

            {isPending && isAdmin && !isRejecting && (
              <div className="flex flex-col sm:flex-row gap-2 mt-1">
               <button 
                 onClick={() => handleUpdate(req.id, 'aprovado', 'Aprovado')}
                 disabled={loadingId === req.id}
                 className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex justify-center items-center gap-1 transition-all"
               >
                 {loadingId === req.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Aprovar
               </button>
               <button 
                 onClick={() => setIsRejecting(true)}
                 disabled={loadingId === req.id}
                 className="flex-1 py-1.5 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex justify-center items-center gap-1 transition-all"
               >
                 <XCircle size={12} /> Rejeitar
               </button>
             </div>
           )}

           {isPending && isRejecting && (
               <div className={`mt-2 p-3 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'} shadow-sm flex flex-col gap-2`}>
                   <label className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>Motivo da Recusa:</label>
                   <textarea id={`rejectReason-${req.id}`} rows={2} placeholder="Justifique a recusa..." className={`w-full p-2 text-xs rounded border outline-none resize-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}></textarea>
                   <div className="flex gap-2 justify-end mt-1">
                      <button onClick={() => setIsRejecting(false)} className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded transition-all ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>Cancelar</button>
                      <button onClick={() => {
                          const val = document.getElementById(`rejectReason-${req.id}`).value.trim();
                          if (!val) return alert("Por favor, digite o motivo da recusa.");
                          handleUpdate(req.id, 'rejeitado', val).then(() => setIsRejecting(false));
                      }} className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[9px] text-white font-black uppercase tracking-widest transition-all">
                        {loadingId === req.id ? <Loader2 size={10} className="animate-spin inline" /> : 'Confirmar'}
                      </button>
                   </div>
               </div>
           )}
        </div>
      </div>
      
      <span className="text-[8px] font-black uppercase tracking-widest opacity-40 mt-1 ml-2">
        {new Date(req.created_at || req.createdAt).toLocaleString([], {day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'})}
      </span>
    </div>
  );
}

function AlertItem({ notif, isDarkMode, isRead, onToggleRead }) {
  const isPrevia = notif.type === 'previa' || notif.type === 'NEW_PREVIA';
  
  return (
    <div className={`flex flex-col text-[11px] font-medium leading-relaxed max-w-[95%] w-full items-start mx-auto mb-2 ${isRead ? 'opacity-70' : ''}`}>
      <div className="w-full flex items-center justify-between mb-1 px-2">
        <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{notif.title || 'ALERTA DO SISTEMA'}</span>
        <button
          onClick={onToggleRead}
          className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border transition-colors ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}
        >
          {isRead ? 'Não lida' : 'Marcar lida'}
        </button>
      </div>
      
      <div className={`w-full p-3 rounded-2xl shadow-sm border flex items-center gap-3 ${isPrevia ? (isDarkMode ? 'bg-indigo-900/40 border-indigo-800/50 text-indigo-100' : 'bg-indigo-50 border-indigo-200 text-indigo-900') : (isDarkMode ? 'bg-emerald-900/40 border-emerald-800/50 text-emerald-100' : 'bg-emerald-50 border-emerald-200 text-emerald-900')}`}>
         <div className={`p-2 rounded-full shrink-0 flex items-center justify-center shadow-lg ${isPrevia ? (isDarkMode ? 'bg-indigo-800 border border-indigo-500/50 text-indigo-100' : 'bg-indigo-500 text-white border border-indigo-600') : (isDarkMode ? 'bg-emerald-800 border border-emerald-500/50 text-emerald-100' : 'bg-emerald-600 text-white border border-emerald-700')}`}>
           {isPrevia ? <CalendarDays size={20} className="animate-pulse" /> : <RefreshCcw size={20} />}
         </div>
         <p className="font-bold flex-1 text-left">{notif.message}</p>
      </div>
      
      <span className="text-[8px] font-black uppercase tracking-widest opacity-40 mt-1 ml-2">
        {new Date(notif.createdAt).toLocaleString([], {day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'})}
      </span>
    </div>
  );
}
