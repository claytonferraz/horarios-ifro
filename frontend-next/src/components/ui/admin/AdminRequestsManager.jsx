import React from 'react';
import { MessageSquare, CheckCircle2, XCircle, Printer, Filter, CalendarDays, UserCheck } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useData } from '@/contexts/DataContext';

export function AdminRequestsManager({ isDarkMode }) {
  const [requests, setRequests] = React.useState([]);
  const { globalTeachers, academicWeeks } = useData();
  const [loadingId, setLoadingId] = React.useState(null);
  const [alertModal, setAlertModal] = React.useState(null);
  const [filterTeacher, setFilterTeacher] = React.useState('');
  const [filterWeek, setFilterWeek] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('');

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
      setAlertModal({ type: 'success', title: 'Sucesso!', msg: `Solicitação ${status} com sucesso!` });
    } catch (e) {
      setAlertModal({ type: 'error', title: 'Erro', msg: "Erro ao atualizar: " + e.message });
    } finally {
      setLoadingId(null);
    }
  };

  // Extrair listas únicas para os filtros
  const uniqueTeachers = [...new Set(requests.map(r => r.requester_id))].filter(Boolean).map(siape => {
    return { siape, name: globalTeachers?.find(t => t.siape === siape)?.nome_exibicao || siape };
  }).sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const uniqueWeeks = [...new Set(requests.map(r => String(r.week_id || r.return_week)))].filter(x => x && x !== 'undefined' && x !== 'null').sort((a,b)=> a.localeCompare(b)).map(wId => {
    if (wId === 'padrao') return { id: wId, label: 'Grade Matriz Oficial (Padrão)' };
    const wData = academicWeeks?.find(w => String(w.id) === wId);
    if (!wData) return { id: wId, label: `Semana Especial (${wId})` };
    const startStr = wData.start_date ? wData.start_date.split('-').reverse().join('/') : '?';
    const endStr = wData.end_date ? wData.end_date.split('-').reverse().join('/') : '?';
    return { id: wId, label: `${wData.name} (${startStr} a ${endStr})` };
  });

  // Aplicar filtros
  const filteredRequests = requests.filter(req => {
    if (filterTeacher && req.requester_id !== filterTeacher) return false;
    if (filterWeek && String(req.week_id || req.return_week) !== filterWeek) return false;
    if (filterStatus) {
       const mappedStatus = req.status === 'pending' ? 'pendente' : req.status === 'aprovada' ? 'aprovado' : req.status;
       
       if (filterStatus === 'automatica') {
           if (req.obs !== 'Homologado Automaticamente') return false;
       } else if (filterStatus === 'aprovado') {
           if (mappedStatus !== 'aprovado' || req.obs === 'Homologado Automaticamente') return false;
       } else {
           if (mappedStatus !== filterStatus) return false;
       }
    }
    return true;
  });

  return (
    <div className="space-y-6 print:m-0 print:space-y-4 print:block">
      {/* HEADER INVISÍVEL PARA IMPRESSÃO */}
      <div className="hidden print:block mb-8 border-b-2 border-slate-800 pb-4">
         <h1 className="text-2xl font-black uppercase tracking-widest text-slate-900">Relatório Administrativo de Solicitações</h1>
         <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">
           Filtros Aplicados: {filterTeacher ? `Professor(a) ${uniqueTeachers.find(t=>t.siape===filterTeacher)?.name || filterTeacher}` : 'Todos os Professores'} | {filterWeek ? `${uniqueWeeks.find(w=>w.id===filterWeek)?.label || filterWeek}` : 'Todas as Semanas / Períodos'} | {filterStatus ? `Status: ${filterStatus}` : 'Todos os Status'}
         </p>
         <p className="text-xs font-medium text-slate-400 mt-1">Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')} via DAPE</p>
      </div>

      <div className={`rounded-2xl shadow-sm border overflow-hidden transition-all print:shadow-none print:border-none print:bg-transparent ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between border-b gap-4 print:hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex items-center gap-3">
             <MessageSquare size={18} className="text-rose-400" />
             <h2 className="font-black text-xs uppercase tracking-[0.2em]">Solicitações de Professores</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
             <div className="flex items-center gap-2 w-full sm:w-auto">
               <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                 <UserCheck size={14} className="opacity-50" />
                 <select 
                   value={filterTeacher} 
                   onChange={(e) => setFilterTeacher(e.target.value)}
                   className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer"
                 >
                   <option value="">Todos os Profs.</option>
                   {uniqueTeachers.map(t => <option key={t.siape} value={t.siape}>{t.name}</option>)}
                 </select>
               </div>
               
               <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                 <CalendarDays size={14} className="opacity-50" />
                 <select 
                   value={filterWeek} 
                   onChange={(e) => setFilterWeek(e.target.value)}
                   className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer"
                 >
                   <option value="">Qqr Semana/Bimestre</option>
                   {uniqueWeeks.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                 </select>
               </div>
               
               <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                 <CheckCircle2 size={14} className="opacity-50" />
                 <select 
                   value={filterStatus} 
                   onChange={(e) => setFilterStatus(e.target.value)}
                   className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer"
                 >
                   <option value="">Qualquer Status</option>
                   <option value="pendente">Pendente</option>
                   <option value="pronto_para_homologacao">Pronto p/ Homologação</option>
                   <option value="aguardando_colega">Aguardando Colega</option>
                   <option value="aprovado">Aprovado (Manual)</option>
                   <option value="automatica">Homologada Automaticamente</option>
                   <option value="rejeitado">Rejeitado</option>
                 </select>
               </div>
             </div>
             
             <button 
               onClick={() => window.print()}
               className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 border ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}
             >
               <Printer size={14} /> Imprimir Filtradas
             </button>
          </div>
        </div>

        <div className="p-4 space-y-4 print:space-y-6">
          {requests.length === 0 ? (
            <div className="text-center py-20 opacity-30">
               <MessageSquare size={48} className="mx-auto mb-4" />
               <p className="text-xs font-black uppercase tracking-widest">Nenhuma solicitação pendente no momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 print:gap-6">
              {filteredRequests.map(req => (
                <RequestCard 
                  key={req.id} 
                  req={req} 
                  isDarkMode={isDarkMode} 
                  loadingId={loadingId} 
                  handleUpdate={handleUpdate} 
                  globalTeachers={globalTeachers} 
                  academicWeeks={academicWeeks}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {alertModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in zoom-in-95">
          <div className={`w-full max-w-sm p-6 rounded-2xl shadow-2xl ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-white' : 'bg-white text-slate-900'}`}>
            <h3 className={`text-lg font-black uppercase tracking-widest flex items-center gap-2 mb-3 ${alertModal.type === 'error' ? 'text-red-500' : 'text-emerald-500'}`}>
              {alertModal.type === 'error' ? <XCircle size={20} /> : <CheckCircle2 size={20} />}
              {alertModal.title}
            </h3>
            <p className="text-sm font-bold opacity-80 mb-6 font-mono">{alertModal.msg}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setAlertModal(null)} 
                className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                autoFocus
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestCard({ req, isDarkMode, loadingId, handleUpdate, globalTeachers, academicWeeks }) {
  const teacherName = globalTeachers?.find(t => t.siape === req.requester_id)?.nome_exibicao || req.requester_id || 'Desconhecido';
  const [feedback, setFeedback] = React.useState(req.admin_feedback || '');

  const targetWeekId = req.week_id || req.return_week;
  const weekData = typeof targetWeekId === 'string' && targetWeekId === 'padrao' ? null : academicWeeks?.find(w => String(w.id) === String(targetWeekId));
  const scheduleTypeName = targetWeekId === 'padrao' ? 'Grade Matriz Oficial (Padrão)' : 
                           weekData ? `Semana da prévia ou horário atual: ${weekData.name} de ${weekData.start_date.split('-').reverse().join('/')} a ${weekData.end_date.split('-').reverse().join('/')}` : 
                           `Semana Isolada / Especial (${targetWeekId})`;

  return (
    <div className={`p-5 rounded-2xl border transition-all print:border-b-2 print:border-t-0 print:border-x-0 print:border-slate-300 print:rounded-none print:p-2 print:bg-transparent print:shadow-none break-inside-avoid ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className="flex flex-col lg:flex-row gap-6 print:flex-row print:flex-nowrap print:items-stretch">
        <div className="flex-1 space-y-3 print:space-y-4 w-full print:flex-1 print:w-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black text-sm print:border print:border-slate-300 print:bg-transparent print:text-slate-800">
                {teacherName.charAt(0)}
              </div>
              <div>
                 <p className={`text-xs font-black uppercase tracking-tight print:text-sm print:text-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{teacherName}</p>
                 <p className="text-[10px] font-bold text-slate-500">SIAPE: {req.requester_id}</p>
              </div>
            </div>
            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest print:bg-transparent print:text-slate-800 print:border print:border-slate-300 print:px-1 ${
              (req.status === 'pendente' || req.status === 'pending' || req.status === 'pronto_para_homologacao' || req.status === 'aguardando_colega') ? (isDarkMode ? 'bg-amber-900/30 text-amber-500' : 'bg-amber-50 text-amber-600') :
              (req.status === 'aprovado' || req.status === 'aprovada' || req.status === 'resolvida') ? (req.obs === 'Homologado Automaticamente' ? (isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600') : (isDarkMode ? 'bg-emerald-900/30 text-emerald-500' : 'bg-emerald-50 text-emerald-600')) :
              (req.status === 'rejeitado' || req.status === 'rejeitada') ? (isDarkMode ? 'bg-rose-900/30 text-rose-500' : 'bg-rose-50 text-rose-600') :
              (isDarkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600')
            }`}>
              {req.status === 'pending' ? 'pendente' : req.status === 'pronto_para_homologacao' ? 'Pronto p/ Homologação' : req.status === 'aguardando_colega' ? 'Aguard. Colega (Pode Forçar)' : (req.status === 'aprovada' || req.status === 'aprovado') && req.obs === 'Homologado Automaticamente' ? 'Homologado Automaticamente' : req.status}
            </span>
          </div>

          <div className={`p-4 rounded-xl text-xs font-medium leading-relaxed print:bg-transparent print:p-0 print:text-sm print:text-black ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-700'}`}>
             <p className="font-bold uppercase text-[9px] text-slate-500 mb-1 tracking-widest print:text-xs">Pedido:</p>
             {req.reason || req.description}
          </div>

          {(req.original_slot || req.proposed_slot) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-3 mt-4 print:mt-2">
               <div className={`p-4 rounded-xl border flex flex-col gap-1.5 print:bg-transparent print:border-slate-300 print:p-2 print:rounded-none ${isDarkMode ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 opacity-70 print:text-slate-800">Original</p>
                  <p className={`text-xs font-bold leading-relaxed print:text-black print:text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    {(() => {
                      try {
                        let parsed = req.original_slot;
                        if (typeof parsed === 'string' && parsed.startsWith('{')) parsed = JSON.parse(parsed);
                        if (typeof parsed === 'string' && parsed.startsWith('"')) parsed = JSON.parse(parsed);
                        if (typeof parsed === 'string' && parsed.startsWith('{')) parsed = JSON.parse(parsed);
                        if (typeof parsed === 'object' && parsed !== null) {
                           const prefix = parsed.subject || parsed.classType || `VAGA na turma ${parsed.className || ''}`;
                           const hasTurmaStr = prefix.toLowerCase().includes('turma') || prefix.toLowerCase().includes(String(parsed.className).toLowerCase());
                           const classInfo = (parsed.className && !hasTurmaStr) ? ` (${parsed.className})` : '';
                           return `${prefix}${classInfo} ${parsed.day ? parsed.day + ' às ' + parsed.time : ''}`.trim();
                        }
                        return String(req.original_slot).replace(/["{}]/g, '');
                      } catch(e) { return String(req.original_slot); }
                    })()}
                  </p>
               </div>
               <div className={`p-4 rounded-xl border flex flex-col gap-1.5 print:bg-transparent print:border-slate-300 print:p-2 print:rounded-none ${isDarkMode ? 'bg-indigo-900/10 border-indigo-900/30' : 'bg-indigo-50 border-indigo-100'}`}>
                  <p className="text-[9px] font-black flex items-center gap-1.5 text-indigo-500 uppercase tracking-widest mb-1 opacity-80 print:text-black"><CheckCircle2 size={12}/> Proposta</p>
                  <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 leading-relaxed drop-shadow-sm print:text-black print:text-[11px] print:drop-shadow-none">
                    {(() => {
                      try {
                        let parsed = req.proposed_slot;
                        if (typeof parsed === 'string' && parsed.startsWith('{')) parsed = JSON.parse(parsed);
                        if (typeof parsed === 'string' && parsed.startsWith('"')) parsed = JSON.parse(parsed);
                        if (typeof parsed === 'string' && parsed.startsWith('{')) parsed = JSON.parse(parsed);
                        if (typeof parsed === 'object' && parsed !== null) {
                           const prefix = parsed.classType || parsed.subject || 'Mudança';
                           const hasTurmaStr = prefix.toLowerCase().includes('turma') || (parsed.className && prefix.toLowerCase().includes(String(parsed.className).toLowerCase()));
                           const classInfo = hasTurmaStr ? '' : ` (${parsed.className || 'Mesma turma'})`;
                           return `${prefix}${classInfo} ${parsed.day ? parsed.day + ' às ' + parsed.time : ''}`.trim();
                        }
                        return String(req.proposed_slot).replace(/["{}]/g, '');
                      } catch(e) { return String(req.proposed_slot); }
                    })()}
                  </p>
               </div>
            </div>
          )}
          
          <div className={`mt-3 p-3 rounded-xl border flex items-center justify-between print:bg-transparent print:border-none print:p-0 print:mt-1 ${isDarkMode ? 'bg-slate-950/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
            <span className="text-[10px] font-black uppercase tracking-widest print:text-black">Semana Alvo: <span className={`print:text-black ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{req.week_id}</span></span>
            <span className="text-[10px] font-bold uppercase tracking-widest print:text-black">{scheduleTypeName}</span>
          </div>
        </div>

        <div className={`w-full lg:w-72 lg:border-l lg:pl-6 space-y-4 flex flex-col justify-center print:w-[35%] print:max-w-[300px] print:border-l print:border-slate-300 print:pl-4 print:ml-4 sm:max-w-none ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
           <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest print:opacity-100 print:text-black">Ação / Resposta</label>
              <textarea 
                placeholder="Feedback para o professor..."
                className={`w-full min-h-[80px] p-3 rounded-xl border text-[11px] font-bold outline-none resize-none transition-all print:border-dashed print:border-slate-400 print:bg-slate-50/50 print:text-black print:min-h-0 print:h-auto ${req.status !== 'pendente' && req.status !== 'pending' && req.status !== 'pronto_para_homologacao' && req.status !== 'aguardando_colega' ? 'opacity-50 print:opacity-100 cursor-not-allowed pointer-events-none' : ''} ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}`}
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                readOnly={req.status !== 'pendente' && req.status !== 'pending' && req.status !== 'pronto_para_homologacao' && req.status !== 'aguardando_colega'}
              />
           </div>
           
           {(req.status === 'pendente' || req.status === 'pending' || req.status === 'pronto_para_homologacao' || req.status === 'aguardando_colega') ? (
               <div className="grid grid-cols-2 gap-2 print:hidden">
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
           ) : (
               <div className={`flex items-center justify-center py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border print:hidden ${(req.status === 'aprovado' || req.status === 'aprovada' || req.status === 'resolvida') ? (isDarkMode ? 'bg-emerald-900/20 border-emerald-900/50 text-emerald-500' : 'bg-emerald-50 border-emerald-200 text-emerald-700') : (isDarkMode ? 'bg-rose-900/20 border-rose-900/50 text-rose-500' : 'bg-rose-50 border-rose-200 text-rose-700')}`}>
                  {(req.status === 'aprovado' || req.status === 'aprovada' || req.status === 'resolvida') ? <CheckCircle2 size={14} className="mr-2" /> : <XCircle size={14} className="mr-2" />}
                  Solicitação Resolvida
               </div>
           )}
        </div>
      </div>
    </div>
  );
}
