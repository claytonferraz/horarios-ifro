import React, { useState } from 'react';
import { MessageSquare, Send, AlertCircle, CheckCircle2, Clock, XCircle, Printer } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useData } from '@/contexts/DataContext';

export function TeacherRequestsSection({ isDarkMode, siape, selectedWeek, weekData, activeDays, classTimes, onCancel, isFloating, scheduleMode, requests: propRequests }) {
  const { academicWeeks, rawData } = useData();
  const [requests, setRequests] = useState(propRequests || []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFloatingOpen, setIsFloatingOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newRequest, setNewRequest] = useState({ description: '', original_slot: '', proposed_day: '', proposed_time: '', proposed_type: 'Regular' });
  const [rejectionTarget, setRejectionTarget] = useState(null);
  const [alertModal, setAlertModal] = useState(null);

  const loadRequests = async () => {
    try {
      const data = await apiClient.fetchRequests(siape);
      setRequests(data || []);
    } catch (e) {
      console.error("Erro ao carregar solicitações", e);
    }
  };

  React.useEffect(() => {
    if (propRequests) setRequests(propRequests);
    if (siape) loadRequests();
  }, [siape, propRequests]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.submitRequest({
        siape,
        week_id: selectedWeek,
        description: newRequest.description,
        original_slot: newRequest.original_slot,
        proposed_slot: { day: newRequest.proposed_day, time: newRequest.proposed_time, classType: newRequest.proposed_type }
      });
      setNewRequest({ description: '', original_slot: '', proposed_day: '', proposed_time: '', proposed_type: 'Regular' });
      setIsModalOpen(false);
      loadRequests();
    } catch (err) {
      alert("Erro ao enviar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isFloating && !isFloatingOpen) {
    return (
      <button onClick={() => setIsFloatingOpen(true)} className="p-3 md:p-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl font-bold flex items-center justify-center gap-2 group/fab relative z-50 transition-all print:hidden">
        <MessageSquare size={20} className="group-hover/fab:scale-110 transition-transform" />
        <span className="whitespace-nowrap overflow-hidden max-w-0 opacity-0 group-hover/fab:max-w-xs group-hover/fab:opacity-100 transition-all duration-300 group-hover/fab:ml-1 hidden sm:inline-block">DAPE</span>
        {requests.length > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-black text-[10px] w-[20px] h-[20px] flex items-center justify-center rounded-full shadow-inner">{requests.length}</span>}
      </button>
    );
  }

  const containerClass = isFloating 
    ? `fixed bottom-20 right-6 w-[500px] max-w-[90vw] p-5 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-[9000] flex flex-col max-h-[80vh] animate-in fade-in slide-in-from-bottom-5 duration-300 origin-bottom-right print:relative print:w-auto print:max-w-none print:shadow-none print:bottom-auto print:left-auto print:p-0 print:border-none print:bg-transparent overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-700/50' : 'bg-white border border-slate-200'}`
    : `mt-8 mb-12 animate-in slide-in-from-bottom-4 print:mt-0 print:mb-0 print:block`;

  return (
    <div className={containerClass}>
      {isFloating && (
         <div className="flex justify-between items-center mb-4 border-b pb-3 print:hidden border-slate-200 dark:border-slate-800 shrink-0">
            <h2 className={`font-black uppercase tracking-widest text-sm flex items-center gap-2 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
              <MessageSquare size={16} /> Solicitações Coordenação
            </h2>
            <button onClick={() => setIsFloatingOpen(false)} className="text-slate-400 hover:bg-rose-500 hover:text-white rounded-full p-1 transition-colors">
              <XCircle size={20} />
            </button>
         </div>
      )}
      
      {/* Header específico para impressão (só aparece em modo print) */}
      <div className="hidden print:block mb-8 border-b-2 border-slate-800 pb-4">
         <h1 className="text-2xl font-black uppercase tracking-widest text-slate-900">Relatório de Solicitações</h1>
         <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Portal do Servidor - SIAPE: {siape}</p>
         <p className="text-xs font-medium text-slate-400 mt-1">Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
      </div>

      <div className={`rounded-xl shadow-lg border overflow-y-auto flex-1 custom-scrollbar transition-all print:overflow-visible print:shadow-none print:border-none print:bg-transparent ${!isFloating && 'rounded-3xl'} ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} ${isFloating ? 'border-none shadow-none' : ''}`}>
        {!isFloating && (
          <div className={`px-6 py-4 flex flex-col sm:flex-row items-center justify-between border-b print:hidden gap-4 ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Minhas Solicitações de Mudança</h3>
              <p className={`text-[10px] font-bold opacity-60 uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Coordenação DAPE</p>
            </div>
            </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={() => window.print()}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-600'}`}
            >
              <Printer size={14} /> Imprimir
            </button>
            <button 
              onClick={() => {
                if (scheduleMode === 'consolidado' || scheduleMode === 'oficial') {
                   alert('Aulas do histórico consolidado só podem ser retificadas diretamente pela gestão (MasterGrid).');
                   return;
                }
                setIsModalOpen(true);
              }}
              title={(scheduleMode === 'consolidado' || scheduleMode === 'oficial') ? "Não é possível solicitar permutas para o Histórico Consolidado." : "Nova Solicitação"}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 ${(scheduleMode === 'consolidado' || scheduleMode === 'oficial') ? 'bg-slate-400 text-slate-200 cursor-not-allowed opacity-60' : (isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95' : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95')}`}
            >
              <Send size={14} /> Nova Solicitação
            </button>
          </div>
        </div>
        )}

        <div className="p-4">
          {requests.length === 0 ? (
            <div className={`p-10 text-center rounded-xl border-2 border-dashed print:border-none print:text-black ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'}`}>
              <MessageSquare size={32} className="mx-auto mb-2 opacity-20 print:hidden" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] print:text-sm">Nenhuma solicitação enviada até o momento</p>
            </div>
          ) : (
            <div className="space-y-3 print:space-y-6">
              {requests.map(req => (
                <div key={req.id} className={`p-4 rounded-xl border transition-all print:border-b-2 print:border-t-0 print:border-x-0 print:border-slate-200 print:rounded-none print:p-2 print:bg-transparent print:shadow-none break-inside-avoid ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-800/70' : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'}`}>
                  <div className="flex flex-col items-start justify-between gap-4 print:flex-row print:flex-nowrap print:gap-6 print:items-stretch">
                    <div className="flex-1 w-full print:flex-1 print:w-auto">
                      <div className="flex flex-wrap items-center gap-2 mb-2 print:flex-nowrap">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest print:bg-transparent print:text-slate-800 print:border print:border-slate-300 print:px-1 ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                          {(() => {
                              const targetWeekId = req.week_id || req.return_week;
                              const wDt = typeof targetWeekId === 'string' && targetWeekId === 'padrao' ? null : academicWeeks?.find(w => String(w.id) === String(targetWeekId));
                              return targetWeekId === 'padrao' ? 'Grade Matriz Oficial (Padrão)' : 
                                     wDt ? `Semana da prévia ou horário atual: ${wDt.name} de ${wDt.start_date.split('-').reverse().join('/')} a ${wDt.end_date.split('-').reverse().join('/')}` : 
                                     `Semana Isolada / Especial (${targetWeekId})`;
                          })()}
                        </span>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1 print:bg-transparent print:border print:border-slate-300 print:text-black print:px-1 ${
                          (req.status === 'pendente' || req.status === 'pending' || req.status === 'pronto_para_homologacao' || req.status === 'aguardando_colega') ? (isDarkMode ? 'bg-amber-900/30 text-amber-500' : 'bg-amber-50 text-amber-600') :
                          (req.status === 'aprovado' || req.status === 'aprovada' || req.status === 'resolvida' || req.status === 'approved') ? (req.obs === 'Homologado Automaticamente' ? (isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600') : (isDarkMode ? 'bg-emerald-900/30 text-emerald-500' : 'bg-emerald-50 text-emerald-600')) :
                          (req.status === 'rejeitado' || req.status === 'rejeitada') ? (isDarkMode ? 'bg-rose-900/30 text-rose-500' : 'bg-rose-50 text-rose-600') :
                          (isDarkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600')
                        }`}>
                          {(req.status === 'pendente' || req.status === 'aguardando_colega' || req.status === 'pronto_para_homologacao') && <Clock size={10} />}
                          {(req.status === 'aprovado' || req.status === 'aprovada' || req.status === 'Resolvida' || req.status === 'approved') && <CheckCircle2 size={10} />}
                          {(req.status === 'rejeitado' || req.status === 'rejeitada') && <XCircle size={10} />}
                          {req.status === 'aguardando_colega' ? 'Aguardando Colega' : req.status === 'pronto_para_homologacao' ? 'Pronto p/ Homologação' : (req.status === 'aprovada' || req.status === 'aprovado') && req.obs === 'Homologado Automaticamente' ? 'Homologado Automaticamente' : req.status}
                        </span>
                      </div>
                      <p className={`text-xs font-bold leading-relaxed mb-1 print:text-sm print:text-black ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{req.reason || req.description}</p>
                      
                      {(req.original_slot || req.proposed_slot) && (
                        <div className={`mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest print:grid-cols-2 print:bg-transparent print:border-slate-200 print:rounded-none print:p-0 print:border-0 print:text-[11px] print:text-black ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                          {(() => {
                             const isReceivedByMe = String(req.substitute_id || '').includes(String(siape));
                             const isSentByMe = String(req.requester_id || '') === String(siape);

                             let pO = req.original_slot; try { if (typeof pO === 'string') pO = JSON.parse(pO); if (typeof pO === 'string') pO = JSON.parse(pO); if (typeof pO === 'string') pO = JSON.parse(pO); } catch(e){}
                             let pP = req.proposed_slot; try { if (typeof pP === 'string') pP = JSON.parse(pP); if (typeof pP === 'string') pP = JSON.parse(pP); if (typeof pP === 'string') pP = JSON.parse(pP); } catch(e){}
                             
                             const resolveLabel = (slot) => {
                                 if (!slot || typeof slot !== 'object') return String(slot || '').replace(/["{}]/g, '');
                                 let subj = slot.subject || slot.classType || '';
                                 let clName = slot.className || slot.classId || '';
                                 if (clName && clName.length > 5 && rawData && rawData.length > 0) {
                                    const match = rawData.find(r => r.className === clName || r.classId === clName || String(r.id) === String(clName));
                                    if (match) {
                                        clName = `${match.course || ''} ${match.className || ''}`.trim() || clName;
                                    }
                                 }
                                 let dayInfo = slot.day ? `${slot.day} às ${slot.time}` : '';
                                 return `${subj} - ${clName} \n ${dayInfo}`.replace(/^ - | - $/g, '').trim();
                             };
                             
                             const origStr = resolveLabel(pO);
                             const propStr = resolveLabel(pP);
                             
                             let leftLabel = "Original / Ofertada";
                             let leftVal = origStr;
                             let rightLabel = "Proposta / Solicitada";
                             let rightVal = propStr;

                             if (req.action_type === 'troca' && isReceivedByMe && !isSentByMe) {
                                // Sou o colega recebendo o pedido. A Aula solicitada (minha) é prop = pP. A Aula ofertada (dele) é orig = pO.
                                leftLabel = "SUA AULA SOLICITADA";
                                leftVal = propStr;
                                rightLabel = "NOVO HORÁRIO PARA TROCA";
                                rightVal = origStr;
                             } else if (req.action_type === 'troca' && isSentByMe) {
                                leftLabel = "SUA AULA OFERTADA";
                                leftVal = origStr;
                                rightLabel = "AULA ALVO SOLICITADA";
                                rightVal = propStr;
                             }

                             return (
                                <>
                                  <div className={`flex flex-col gap-1 pb-2 border-b sm:border-b-0 sm:pr-2 sm:border-r print:border-r print:border-slate-300 print:pr-4 print:pb-0 print:border-b-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                                    <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{leftLabel}</span>
                                    <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{leftVal}</span>
                                  </div>
                                  <div className={`flex flex-col gap-1 pl-1`}>
                                    <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{rightLabel}</span>
                                    <span className={isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}>{rightVal}</span>
                                  </div>
                                </>
                             );
                          })()}
                        </div>
                      )}
                    </div>

                    {req.status === 'aguardando_colega' && String(req.substitute_id || '').includes(String(siape)) && (
                      <div className="mt-3 flex justify-end print:hidden">
                        <button onClick={() => {
                          let origName = "Aula Original"; let origTime = "";
                          let propName = "Aula Proposta"; let propTime = "";
                          try {
                             let pO = req.original_slot; if (typeof pO === 'string') pO = JSON.parse(pO);
                             if (typeof pO === 'string') pO = JSON.parse(pO);
                             if (typeof pO === 'string') pO = JSON.parse(pO);
                             origName = pO.subject || pO.classType || "Aula Original";
                             origTime = `${pO.day} às ${pO.time}`;
                          } catch(e) {}
                          try {
                             let pP = req.proposed_slot; if (typeof pP === 'string') pP = JSON.parse(pP);
                             if (typeof pP === 'string') pP = JSON.parse(pP);
                             if (typeof pP === 'string') pP = JSON.parse(pP);
                             propName = pP.subject || pP.classType || "Aula Proposta";
                             propTime = `${pP.day} às ${pP.time}`;
                          } catch(e) {}
                          setRejectionTarget(req);
                        }} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 shadow-sm border border-rose-200 transition-all mr-2">Recusar</button>

                        
                        <button onClick={() => {
                          let origName = "Aula Original"; let origTime = "";
                          let propName = "Aula Proposta"; let propTime = "";
                          try {
                             let pO = req.original_slot; if (typeof pO === 'string') pO = JSON.parse(pO);
                             if (typeof pO === 'string') pO = JSON.parse(pO);
                             if (typeof pO === 'string') pO = JSON.parse(pO);
                             origName = pO.subject || pO.classType || "Aula Original";
                             origTime = `${pO.day} às ${pO.time}`;
                          } catch(e) {}
                          try {
                             let pP = req.proposed_slot; if (typeof pP === 'string') pP = JSON.parse(pP);
                             if (typeof pP === 'string') pP = JSON.parse(pP);
                             if (typeof pP === 'string') pP = JSON.parse(pP);
                             propName = pP.subject || pP.classType || "Aula Proposta";
                             propTime = `${pP.day} às ${pP.time}`;
                          } catch(e) {}

                          const acceptMsg = `O colega aceitou permutar a ${propName} (${propTime}) pela sua ${origName} (${origTime}). Aguardando Homologação da Gestão.`;

                          apiClient.updateRequestStatus(req.id, 'pronto_para_homologacao', '', acceptMsg).then(() => {
                            setAlertModal({ title: 'Permuta Aceita!', message: 'A coordenação foi notificada para homologar.', type: 'success', onClose: () => {
                              loadRequests();
                              if (typeof onCancel === 'function') onCancel();
                            }});
                          });
                        }} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-emerald-600 text-white shadow-md hover:bg-emerald-500">Aceitar Permuta</button>
                      </div>
                    )}
                    
                    {req.admin_feedback && (
                      <div className={`w-full sm:max-w-[200px] print:w-[35%] print:max-w-[300px] p-3 rounded-lg border text-[10px] mt-3 sm:mt-0 print:mt-0 animate-in fade-in slide-in-from-right-2 print:border-dashed print:border-slate-400 print:bg-slate-50/50 print:text-black print:p-3 ${isDarkMode ? 'bg-indigo-900/20 border-indigo-800/50 text-indigo-300' : 'bg-indigo-50 border-indigo-100 text-indigo-800'}`}>
                        <div className="flex items-center gap-1.5 mb-1 opacity-70 print:opacity-100">
                          <AlertCircle size={12} />
                          <span className="font-black uppercase tracking-widest print:text-xs">Feedback DAPE</span>
                        </div>
                        <p className="font-bold leading-relaxed print:text-sm">{req.admin_feedback}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE NOVA SOLICITAÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
            <div className={`px-6 py-5 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800 bg-slate-800/30' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg rotate-3">
                  <Send size={18} />
                </div>
                <div>
                  <h3 className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Nova Solicitação</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Preencha os detalhes da mudança</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Descrição do Pedido</label>
                <textarea 
                  required
                  placeholder="Explique o motivo da solicitação e os detalhes da mudança..."
                  className={`w-full min-h-[100px] p-4 rounded-2xl border text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none resize-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  value={newRequest.description}
                  onChange={e => setNewRequest({...newRequest, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Horário Original (Selecione o slot atual)</label>
                  <select 
                    required
                    className={`w-full p-3.5 rounded-xl border text-xs font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    value={newRequest.original_slot}
                    onChange={e => setNewRequest({...newRequest, original_slot: e.target.value})}
                  >
                     <option value="">Selecione a aula atual</option>
                     {weekData.map(r => (
                        <option key={r.id} value={`${r.day} ${r.time} - ${r.className} (${r.subject})`}>
                           {r.day} {r.time} | Turma: {r.className} | {r.subject}
                        </option>
                     ))}
                  </select>
                </div>
                <div className="space-y-1.5 flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Horário Proposto</label>
                  <div className="flex gap-2">
                     <select required className={`w-1/2 p-2.5 rounded-xl border text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                       value={newRequest.proposed_day} onChange={e => setNewRequest({...newRequest, proposed_day: e.target.value})}
                     >
                       <option value="">Selecione o Dia</option>
                       {activeDays?.map(d => <option key={d} value={d}>{d}</option>)}
                     </select>
                     <select required className={`w-1/2 p-2.5 rounded-xl border text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                       value={newRequest.proposed_time} onChange={e => setNewRequest({...newRequest, proposed_time: e.target.value})}
                     >
                       <option value="">Selecione a Hora</option>
                       {classTimes?.map(t => <option key={t.timeStr} value={t.timeStr}>{t.timeStr} ({t.shift})</option>)}
                     </select>
                  </div>
                  <select required className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none mt-1 ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    value={newRequest.proposed_type} onChange={e => setNewRequest({...newRequest, proposed_type: e.target.value})}
                  >
                    {['Regular', 'Recuperação', 'Exame', 'Atendimento'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className={`p-4 rounded-2xl border flex items-start gap-3 mt-2 ${isDarkMode ? 'bg-amber-900/10 border-amber-800/30 text-amber-500' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold leading-relaxed uppercase tracking-wide">
                  Sua solicitação será analisada pela coordenação. Você receberá o feedback diretamente nesta seção.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2 ${loading ? 'bg-slate-400 cursor-not-allowed text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                >
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={14} />}
                  Enviar Solicitação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rejectionTarget && (
        <div className="fixed inset-0 z-[9999] flex justify-center items-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:hidden text-left" onClick={(e) => e.stopPropagation()}>
           <div className={`w-full max-w-sm rounded-2xl shadow-xl flex flex-col overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200'}`}>
              <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                 <h3 className="font-black uppercase tracking-widest text-[11px] text-rose-500 flex items-center gap-2"><XCircle size={14}/> Recusar Permuta</h3>
              </div>
              <div className="p-4 flex flex-col gap-3">
                 <label className={`text-[10px] font-black uppercase tracking-widest opacity-70 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Justificativa:</label>
                 <textarea id="rejectionReasonText" rows={3} placeholder="Escreva o motivo para informar o colega..." className={`w-full p-3 rounded-xl border text-xs outline-none focus:ring-2 focus:ring-rose-500/50 resize-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'}`}></textarea>
                 
                 <div className="flex gap-2 justify-end mt-2">
                   <button onClick={() => setRejectionTarget(null)} className={`px-4 py-2 font-black uppercase tracking-widest text-[10px] rounded-lg transition-all ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>Cancelar</button>
                   <button onClick={() => {
                      const msg = document.getElementById('rejectionReasonText').value.trim();
                      if(!msg) return alert('É necessário justificar a recusa.');
                      const currentReq = rejectionTarget;
                      const rejectMsg = `Permuta Rejeitada pelo colega. Justificativa: ${msg || 'Sem justificativa.'}`;
                      apiClient.updateRequestStatus(currentReq.id, 'rejeitado', msg || '', rejectMsg).then(() => {
                        setRejectionTarget(null);
                        loadRequests();
                        setAlertModal({ title: 'Aviso', message: 'Aviso de recusa enviado ao colega.', type: 'alert' });
                      }).catch((e) => setAlertModal({ title: 'Erro', message: "Erro ao rejeitar: " + e.message, type: 'error' }));
                   }} className="px-5 py-2 font-black uppercase tracking-widest text-[10px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md active:scale-95 transition-all">Confirmar Recusa</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL GLOBAL ESTILIZADO PARA FEEDBACKS (Ex: Sucesso) */}
      {alertModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div className={`w-full max-w-sm p-6 rounded-3xl shadow-2xl flex flex-col items-center text-center ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border`}>
            {alertModal.type === 'error' && <AlertCircle size={48} className={`mb-4 ${isDarkMode ? 'text-rose-400' : 'text-rose-500'}`} />}
            {alertModal.type === 'success' && <CheckCircle2 size={48} className={`mb-4 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-500'}`} />}
            {alertModal.type === 'alert' && <AlertCircle size={48} className={`mb-4 ${isDarkMode ? 'text-amber-400' : 'text-amber-500'}`} />}
            
            <h3 className={`text-lg font-black mb-2 uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{alertModal.title}</h3>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{alertModal.message}</p>
            
            <button 
              onClick={() => {
                setAlertModal(null);
                if (alertModal.onClose) alertModal.onClose();
              }}
              className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-all active:scale-95 ${alertModal.type === 'error' ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]' : alertModal.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-amber-500 hover:bg-amber-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]'}`}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
