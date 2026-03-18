import React from 'react';
import { 
  Upload, Link as LinkIcon, FileText, Trash2,
  MessageSquare, Clock, CheckCircle2, XCircle, Send, AlertCircle
} from 'lucide-react';
import { AdminStatsPanel } from '../ui/AdminStatsPanel';
import { ScheduleConfigPanel } from '../ui/admin/ScheduleConfigPanel';
import { AcademicWeeksPanel } from '../ui/admin/AcademicWeeksPanel';
import { AcademicYearsManager } from '../ui/admin/AcademicYearsManager';
import { CurriculumManager } from '../ui/admin/CurriculumManager';
import { MultiSelect } from '../ui/MultiSelect';
import { InlineInput } from '../ui/InlineInput';
import { apiClient } from '@/lib/apiClient';
import { useData } from '@/contexts/DataContext';


export function GestaoHorarios({
  isDarkMode,
  adminStats,
  adminTab, setAdminTab,
  userRole,
  dbSummary,
  uploadType, setUploadType,
  addInputRef,
  handleFileUpload,
  setImportUrlModal,
  triggerCompare,
  toggleVisibility,
  handleOpenDelete,
  adminAvailableCourses, adminFilterCourses, setAdminFilterCourses,
  adminAvailableClasses, adminFilterClasses, setAdminFilterClasses,
  groupedDisciplinesBySerie,
  subjectHoursMeta, loadAdminMetadata,
  uniqueYearsData, academicYearsMeta
}) {
  const { academicWeeks, activeDays } = useData();

  return (
    <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
        
        <AdminStatsPanel adminStats={adminStats} isDarkMode={isDarkMode} />

        {/* BARRA DE NAVEGAÇÃO INTERNA ADMIN */}
        <div className={`flex flex-wrap p-1.5 rounded-xl shadow-inner w-full mb-4 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
          <button onClick={() => setAdminTab('planilhas')} className={`flex-1 min-w-[120px] md:flex-none flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${adminTab === 'planilhas' ? (isDarkMode ? 'bg-slate-800 text-slate-100 shadow-sm' : 'bg-white text-slate-800 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}><Database size={16} /> Gestão de Planilhas</button>
          <button onClick={() => setAdminTab('disciplinas')} className={`flex-1 min-w-[120px] md:flex-none flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${adminTab === 'disciplinas' ? (isDarkMode ? 'bg-slate-800 text-indigo-400 shadow-sm' : 'bg-white text-indigo-700 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}><ClipboardList size={16} /> Gestão Escolar</button>
          {['admin','gestao'].includes(userRole) && <button onClick={() => setAdminTab('solicitacoes')} className={`flex-1 min-w-[120px] md:flex-none flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${adminTab === 'solicitacoes' ? (isDarkMode ? 'bg-slate-800 text-rose-400 shadow-sm' : 'bg-white text-rose-700 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}><MessageSquare size={16} /> Solicitações</button>}
          {['admin','gestao'].includes(userRole) && <button onClick={() => setAdminTab('configuracoes')} className={`flex-1 min-w-[120px] md:flex-none flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${adminTab === 'configuracoes' ? (isDarkMode ? 'bg-slate-800 text-amber-400 shadow-sm' : 'bg-white text-amber-600 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}><Settings size={16} /> Configurações de Horários</button>}
        </div>

        {/* ABA 4: CONFIGURAÇÕES DE HORÁRIOS */}
        {adminTab === 'configuracoes' && ['admin','gestao'].includes(userRole) && (
          <div className="space-y-6">
            <ScheduleConfigPanel isDarkMode={isDarkMode} />
          </div>
        )}

        {/* ABA 1: PLANILHAS */}
        {adminTab === 'planilhas' && (
          <div className={`rounded-2xl shadow-sm border overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`text-white px-6 py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 border-slate-800'}`}>
              <div className="flex items-center gap-3">
                <Database size={18} className="text-indigo-400" />
                <h2 className="font-black text-xs uppercase tracking-[0.2em]">Gestão de Planilhas</h2>
                <span className="bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded-full font-black tracking-widest uppercase ml-2">{dbSummary.length} Envios</span>
              </div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
                <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700 w-full sm:w-auto">
                  <button onClick={() => setUploadType('padrao')} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${uploadType === 'padrao' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Padrão Anual</button>
                  <button onClick={() => setUploadType('oficial')} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${uploadType === 'oficial' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Oficial</button>
                  <button onClick={() => setUploadType('previa')} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${uploadType === 'previa' ? 'bg-violet-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Prévia</button>
                </div>

                <button 
                  onClick={() => addInputRef.current.click()}
                  className={`flex justify-center items-center gap-2 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 w-full sm:w-auto ${uploadType === 'previa' ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-900/20' : uploadType === 'padrao' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20'}`}
                >
                  <Upload size={14} /> Enviar Arquivo
                </button>

                <button 
                  onClick={() => setImportUrlModal({show: true, url: ''})}
                  className={`flex justify-center items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 w-full sm:w-auto`}
                >
                  <LinkIcon size={14} /> Importar URL
                </button>
                
                <input type="file" ref={addInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className={`border-b text-[9px] uppercase tracking-[0.2em] font-black ${isDarkMode ? 'bg-slate-800/50 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                    <th className="py-4 px-6">Semana / Arquivo</th>
                    <th className="py-4 px-6 text-center">Tipo</th>
                    <th className="py-4 px-6 text-center">Atualizado</th>
                    <th className="py-4 px-6 text-center">Visibilidade</th>
                    <th className="py-4 px-6 text-right">Controles</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                  {dbSummary.length > 0 ? dbSummary.map((item) => (
                    <tr key={item.key} className={`transition-colors group ${!item.isActive ? (isDarkMode ? 'bg-slate-900/50 grayscale opacity-60' : 'bg-slate-50/50 grayscale opacity-60') : (isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50')}`}>
                      <td className="py-3 px-6">
                        <div className={`font-black flex items-center ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                          {item.week}
                          <span className="ml-2 text-slate-400 font-medium text-[10px]">({item.count} aulas)</span>
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold truncate max-w-[250px] flex items-center gap-1 mt-0.5" title={item.fileName}>
                          <FileText size={10} /> {item.fileName}
                        </div>
                      </td>
                      <td className="py-3 px-6 text-center">
                        {item.type === 'padrao' ? (
                          <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-widest border ${isDarkMode ? 'bg-blue-900/40 text-blue-300 border-blue-800/50' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>Horário Padrão</span>
                        ) : item.type === 'previa' ? (
                          <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-widest border ${isDarkMode ? 'bg-violet-900/40 text-violet-300 border-violet-800/50' : 'bg-violet-100 text-violet-800 border-violet-200'}`}>Prévia</span>
                        ) : (
                          <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-widest border ${isDarkMode ? 'bg-emerald-900/40 text-emerald-300 border-emerald-800/50' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>Consolidado</span>
                        )}
                      </td>
                      <td className="py-3 px-6 text-center">
                        {item.updatedAt ? (
                          <span className="text-[10px] font-medium text-slate-500" title={new Date(item.updatedAt).toLocaleString('pt-BR')}>
                             {new Date(item.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}{' '}
                             <span className="opacity-70">{new Date(item.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute:'2-digit' })}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 opacity-50">-</span>
                        )}
                      </td>
                      <td className="py-3 px-6 text-center">
                        {item.isActive 
                          ? <span className={`font-bold text-[10px] uppercase tracking-wider ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Público</span>
                          : <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Oculto</span>
                        }
                      </td>
                      <td className="py-3 px-6 text-right space-x-2">
                        <button onClick={() => triggerCompare(item.key)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm">Alterar</button>
                        <button onClick={() => toggleVisibility(item)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${item.isActive ? (isDarkMode ? 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100') : (isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-800 border-slate-800 text-white')}`}>{item.isActive ? 'Ocultar' : 'Exibir'}</button>
                        <button onClick={() => handleOpenDelete(item.key, item.week)} className={`px-2 py-1.5 rounded-lg transition-all ${isDarkMode ? 'text-rose-400 hover:bg-rose-900/30' : 'text-rose-600 hover:bg-rose-50'}`}><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={5} className="py-8 text-center text-slate-400 font-black uppercase tracking-widest text-xs">Nenhuma semana registrada no banco de dados.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA 2: GESTÃO ESCOLAR */}
        {adminTab === 'disciplinas' && (
          <CurriculumManager 
            isDarkMode={isDarkMode} 
            academicYearsMeta={academicYearsMeta} 
            groupedDisciplinesBySerie={groupedDisciplinesBySerie}
          />
        )}

        {adminTab === 'ano_letivo' && (
          <AcademicYearsManager
            isDarkMode={isDarkMode}
            academicYearsMeta={academicYearsMeta}
            uniqueYearsData={uniqueYearsData}
            loadAdminMetadata={loadAdminMetadata}
            academicWeeks={academicWeeks}
            activeDays={activeDays}
          />
        )}

        {adminTab === 'solicitacoes' && ['admin','gestao'].includes(userRole) && (
          <AdminRequestsManager isDarkMode={isDarkMode} />
        )}
    </div>
  );
}

function AdminRequestsManager({ isDarkMode }) {
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
              {requests.map(req => {
                const teacherName = globalTeachers.find(t => t.siape === req.siape)?.nome_exibicao || req.siape;
                const [feedback, setFeedback] = React.useState(req.admin_feedback || '');

                return (
                  <div key={req.id} className={`p-5 rounded-2xl border transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
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
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
