import React from 'react';
import { 
  Database, ClipboardList, CalendarDays, Settings, 
  Upload, Link as LinkIcon, FileText, Trash2 
} from 'lucide-react';
import { AdminStatsPanel } from '../ui/AdminStatsPanel';
import { ScheduleConfigPanel } from '../ui/admin/ScheduleConfigPanel';
import { AcademicWeeksPanel } from '../ui/admin/AcademicWeeksPanel';
import { AcademicYearsManager } from '../ui/admin/AcademicYearsManager';
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
          <button onClick={() => setAdminTab('disciplinas')} className={`flex-1 min-w-[120px] md:flex-none flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${adminTab === 'disciplinas' ? (isDarkMode ? 'bg-slate-800 text-indigo-400 shadow-sm' : 'bg-white text-indigo-700 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}><ClipboardList size={16} /> Detalhamento de Disciplinas</button>
          <button onClick={() => setAdminTab('ano_letivo')} className={`flex-1 min-w-[120px] md:flex-none flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${adminTab === 'ano_letivo' ? (isDarkMode ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'bg-white text-emerald-700 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}><CalendarDays size={16} /> Controle do Ano Letivo</button>
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

        {/* ABA 2: DETALHAMENTO DE DISCIPLINAS */}
        {adminTab === 'disciplinas' && (
          <div className={`rounded-2xl shadow-sm border overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`text-white px-6 py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 border-slate-800'}`}>
              <div className="flex items-center gap-3">
                <ClipboardList size={18} className="text-indigo-400" />
                <h2 className="font-black text-xs uppercase tracking-[0.2em]">Detalhamento de Disciplinas</h2>
              </div>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Calculado sobre a Base Oficial Consolidada</p>
            </div>
            
            {/* FILTROS DA ABA DE DISCIPLINAS */}
            <div className={`p-4 border-b grid grid-cols-1 md:grid-cols-2 gap-4 ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
              <div className="space-y-1">
                <label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1">Filtrar Cursos</label>
                <MultiSelect 
                  isDarkMode={isDarkMode} 
                  options={adminAvailableCourses} 
                  values={adminFilterCourses} 
                  onChange={setAdminFilterCourses} 
                  colorClass={isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-sm' : 'bg-white border-slate-200 text-slate-800 shadow-sm'} 
                  placeholder="Todos os Cursos" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1">Filtrar Turmas</label>
                <MultiSelect 
                  isDarkMode={isDarkMode} 
                  options={adminAvailableClasses} 
                  values={adminFilterClasses} 
                  onChange={setAdminFilterClasses} 
                  colorClass={isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-sm' : 'bg-white border-slate-200 text-slate-800 shadow-sm'} 
                  placeholder="Todas as Turmas" 
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                  <tr className={`border-b uppercase tracking-widest font-black ${isDarkMode ? 'bg-slate-800/50 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    <th className="py-4 px-4 border-r dark:border-slate-700 w-32">Curso</th>
                    <th className="py-4 px-4 border-r dark:border-slate-700 w-24">Turma</th>
                    <th className="py-4 px-4 border-r dark:border-slate-700">Disciplina</th>
                    <th className="py-4 px-4 border-r dark:border-slate-700">Professor(es)</th>
                    <th className="py-4 px-3 text-center border-r dark:border-slate-700">Carga Horária<br/>Total</th>
                    <th className="py-4 px-3 text-center border-r dark:border-slate-700">CH<br/>Ministrada</th>
                    <th className="py-4 px-3 text-center border-r dark:border-slate-700">Aulas<br/>no SUAP</th>
                    <th className="py-4 px-3 text-center">Para<br/>Lançar</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                  {Object.keys(groupedDisciplinesBySerie).length > 0 ? (
                    Object.keys(groupedDisciplinesBySerie).sort().map(serie => (
                      <React.Fragment key={serie}>
                        <tr className={`${isDarkMode ? 'bg-slate-900/80' : 'bg-slate-100/80'}`}>
                          <td colSpan={8} className="py-2 px-4 font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 text-xs shadow-inner">
                            {serie === 'Outras' ? 'Outras Turmas' : `${serie}º Ano / Série`}
                          </td>
                        </tr>
                        {groupedDisciplinesBySerie[serie].map((item) => {
                          const metaKey = `${item.course}|${item.className}|${item.subject}`;
                          const meta = subjectHoursMeta[metaKey] || { total: '', current: '' };
                          const diff = (parseInt(meta.current) || 0) - item.taught;
                          const hasDiscrepancy = diff !== 0 && meta.current !== '';

                          return (
                            <tr key={item.id} className={`transition-colors ${isDarkMode ? 'hover:bg-slate-800/80' : 'hover:bg-slate-50'}`}>
                              <td className="py-3 px-4 border-r dark:border-slate-700 font-bold">{item.course}</td>
                              <td className="py-3 px-4 border-r dark:border-slate-700 whitespace-nowrap">{item.className}</td>
                              <td className="py-3 px-4 border-r dark:border-slate-700 font-bold">{item.subject}</td>
                              <td className="py-3 px-4 border-r dark:border-slate-700 opacity-80">{item.teachersList}</td>
                              <td className="py-2 px-3 border-r dark:border-slate-700">
                                <InlineInput 
                                  isDarkMode={isDarkMode} 
                                  value={meta.total} 
                                  placeholder="0" 
                                  onSave={(val) => apiClient.saveSubjectHoursMeta(metaKey, { total: val, current: meta.current }).then(() => loadAdminMetadata())} 
                                />
                              </td>
                              <td className="py-2 px-3 border-r dark:border-slate-700 text-center text-lg font-black text-emerald-500">
                                {item.taught}
                              </td>
                              <td className={`py-2 px-3 border-r dark:border-slate-700 transition-colors ${hasDiscrepancy ? (isDarkMode?'bg-rose-900/10':'bg-rose-50') : ''}`}>
                                <InlineInput 
                                  isDarkMode={isDarkMode} 
                                  value={meta.current} 
                                  placeholder="0" 
                                  onSave={(val) => apiClient.saveSubjectHoursMeta(metaKey, { total: meta.total, current: val }).then(() => loadAdminMetadata())} 
                                />
                              </td>
                              <td className="py-3 px-3 text-center">
                                {meta.current !== '' ? (
                                  hasDiscrepancy ? (
                                    <span className={`font-black uppercase tracking-widest px-2 py-1 rounded-lg text-[9px] ${diff > 0 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                                      {diff > 0 ? `+${diff}` : diff}
                                    </span>
                                  ) : (
                                    <span className="font-black text-slate-300 dark:text-slate-600">Ok</span>
                                  )
                                ) : <span className="text-slate-300 dark:text-slate-600">-</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))
                  ) : <tr><td colSpan={8} className="py-8 text-center text-slate-400 font-black uppercase tracking-widest text-xs">Nenhum horário oficial encontrado com os filtros atuais.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
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
    </div>
  );
}
