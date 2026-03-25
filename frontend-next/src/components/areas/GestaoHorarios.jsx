import React from 'react';
import { 
  Upload, Link as LinkIcon, FileText, Trash2,
  MessageSquare, Clock, CheckCircle2, XCircle, Send, AlertCircle,
  Database, ClipboardList, Settings, Home, Calendar
} from 'lucide-react';
import { MasterGrid } from '../ui/admin/MasterGrid';
import { AdminStatsPanel } from '../ui/AdminStatsPanel';
import { ScheduleConfigPanel } from '../ui/admin/ScheduleConfigPanel';
import { AcademicWeeksPanel } from '../ui/admin/AcademicWeeksPanel';
import { AcademicYearsManager } from '../ui/admin/AcademicYearsManager';
import { CurriculumManager } from '../ui/admin/CurriculumManager';
import { MultiSelect } from '../ui/MultiSelect';
import { InlineInput } from '../ui/InlineInput';
import { apiClient } from '@/lib/apiClient';
import { useData } from '@/contexts/DataContext';
import { CalendarDays } from 'lucide-react';
import { AdminRequestsManager } from '../ui/admin/AdminRequestsManager';


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
  uniqueYearsData, academicYearsMeta,
  ...props
}) {
  const { academicWeeks, activeDays } = useData();

  return (
    <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
        
        <div className="print:hidden">
            <AdminStatsPanel adminStats={adminStats} isDarkMode={isDarkMode} />
        </div>

        {/* BARRA DE NAVEGAÇÃO INTERNA ADMIN (REFINADA) */}
        <div className={`flex flex-wrap items-center gap-2 p-1.5 rounded-xl shadow-inner w-full mb-4 print:hidden ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
          
          <button onClick={() => setAdminTab('dashboard')} 
                  className={`px-6 py-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${adminTab === 'dashboard' ? 'bg-slate-700 text-white shadow-lg' : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100')}`}>
            <Home size={16} /> Painel Administrador
          </button>

          {/* DESTAQUES (MASTER GRID & SOLICITAÇÕES) */}
          {['admin','gestao'].includes(userRole) && (
            <button onClick={() => { setAdminTab('master_grid'); props.setScheduleMode('previa'); props.setViewMode('curso'); }} 
                    className={`flex-1 sm:flex-none min-w-[150px] flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${adminTab === 'master_grid' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 ring-2 ring-indigo-400/50' : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100')}`}>
              <CalendarDays size={16} /> Montar Horário
            </button>
          )}
          
          {['admin','gestao'].includes(userRole) && (
             <button onClick={() => setAdminTab('solicitacoes')} 
                     className={`flex-1 sm:flex-none min-w-[150px] flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${adminTab === 'solicitacoes' ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/40 ring-2 ring-rose-400/50' : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100')}`}>
               <MessageSquare size={16} /> Solicitações
             </button>
          )}

          {/* DROPDOWN MENU PARA OUTRAS FUNÇÕES */}
          <div className="relative group ml-auto flex-1 sm:flex-none">
            <button className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${['disciplinas', 'ano_letivo', 'configuracoes'].includes(adminTab) ? (isDarkMode ? 'bg-slate-800 border border-slate-700 text-emerald-400' : 'bg-white border border-slate-300 text-emerald-600') : (isDarkMode ? 'bg-slate-800/50 text-slate-400 hover:text-slate-200' : 'bg-white/50 text-slate-500 hover:text-slate-800 border border-transparent')}`}>
              <Settings size={14} /> Mais Configurações
            </button>
            
            {/* Overlay invisível para fechar ao sair do hover */}
            <div className={`absolute right-0 sm:right-0 lg:left-0 lg:right-auto top-full mt-2 w-64 rounded-xl shadow-2xl p-2 z-[99] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
               
               <button onClick={() => setAdminTab('disciplinas')} 
                       className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all mb-1 ${adminTab === 'disciplinas' ? (isDarkMode ? 'bg-slate-900 text-indigo-400' : 'bg-slate-100 text-indigo-600') : (isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-50 text-slate-600')}`}>
                 <ClipboardList size={14} /> Gestão Escolar
               </button>
               
               {['admin','gestao'].includes(userRole) && (
                 <button onClick={() => setAdminTab('ano_letivo')} 
                         className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all mb-1 ${adminTab === 'ano_letivo' ? (isDarkMode ? 'bg-slate-900 text-emerald-400' : 'bg-slate-100 text-emerald-600') : (isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-50 text-slate-600')}`}>
                   <CalendarDays size={14} /> Ano Letivo
                 </button>
               )}
               
               {['admin','gestao'].includes(userRole) && (
                 <button onClick={() => setAdminTab('configuracoes')} 
                         className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${adminTab === 'configuracoes' ? (isDarkMode ? 'bg-slate-900 text-amber-400' : 'bg-slate-100 text-amber-600') : (isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-50 text-slate-600')}`}>
                   <Settings size={14} /> Config. de Horários
                 </button>
               )}
            </div>
          </div>
        </div>

        {/* ABA 4: CONFIGURAÇÕES DE HORÁRIOS */}
        {adminTab === 'configuracoes' && ['admin','gestao'].includes(userRole) && (
          <div className="space-y-6">
            <ScheduleConfigPanel isDarkMode={isDarkMode} />
          </div>
        )}

        {/* DASHBOARD INICIAL ADMIN - CARDS ELEGANTES */}
        {adminTab === 'dashboard' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in duration-500">
             
             {/* Card 1: Montar Horário */}
             {['admin','gestao'].includes(userRole) && (
               <button onClick={() => { setAdminTab('master_grid'); props.setScheduleMode('previa'); props.setViewMode('curso'); }} 
                       className={`group p-8 rounded-[2.5rem] border text-left transition-all hover:scale-[1.02] active:scale-95 ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10' : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-2xl hover:shadow-indigo-500/5'}`}>
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${isDarkMode ? 'bg-indigo-950 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                   <CalendarDays size={28} />
                 </div>
                 <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Montar Horário</h3>
                 <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Gestão dinâmica de turmas e salas. Arraste e solte para organizar a grade de aulas e ambientes.</p>
               </button>
             )}

             {/* Card 2: Solicitações */}
             {['admin','gestao'].includes(userRole) && (
               <button onClick={() => setAdminTab('solicitacoes')} 
                       className={`group p-8 rounded-[2.5rem] border text-left transition-all hover:scale-[1.02] active:scale-95 ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-rose-500/50 hover:shadow-2xl hover:shadow-rose-500/10' : 'bg-white border-slate-200 hover:border-rose-300 hover:shadow-2xl hover:shadow-rose-500/5'}`}>
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${isDarkMode ? 'bg-rose-950 text-rose-400 group-hover:bg-rose-600 group-hover:text-white' : 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white'}`}>
                   <MessageSquare size={28} />
                 </div>
                 <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Solicitações</h3>
                 <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Gerencie pedidos de permutas, reposições e lançamentos extras realizados pelos professores.</p>
               </button>
             )}

             {/* Card 3: Gestão Escolar */}
             <button onClick={() => setAdminTab('disciplinas')} 
                     className={`group p-8 rounded-[2.5rem] border text-left transition-all hover:scale-[1.02] active:scale-95 ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/10' : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-2xl hover:shadow-emerald-500/5'}`}>
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${isDarkMode ? 'bg-emerald-950 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'}`}>
                 <ClipboardList size={28} />
               </div>
               <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Gestão Escolar</h3>
               <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Base de dados de disciplinas, cursos, turmas e ambientes pedagógicos/laboratórios.</p>
             </button>

             {/* Card 4: Ano Letivo */}
             {['admin','gestao'].includes(userRole) && (
               <button onClick={() => setAdminTab('ano_letivo')} 
                       className={`group p-8 rounded-[2.5rem] border text-left transition-all hover:scale-[1.02] active:scale-95 ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-teal-500/50 hover:shadow-2xl hover:shadow-teal-500/10' : 'bg-white border-slate-200 hover:border-teal-300 hover:shadow-2xl hover:shadow-teal-500/5'}`}>
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${isDarkMode ? 'bg-teal-950 text-teal-400 group-hover:bg-teal-600 group-hover:text-white' : 'bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white'}`}>
                   <Calendar size={28} />
                 </div>
                 <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Calendário Letivo</h3>
                 <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Configure datas de semestres, bimestres e semanas letivas para o controle acadêmico.</p>
               </button>
             )}

             {/* Card 5: Configurações */}
             {['admin','gestao'].includes(userRole) && (
               <button onClick={() => setAdminTab('configuracoes')} 
                       className={`group p-8 rounded-[2.5rem] border text-left transition-all hover:scale-[1.02] active:scale-95 ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-amber-500/50 hover:shadow-2xl hover:shadow-amber-500/10' : 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-2xl hover:shadow-amber-500/5'}`}>
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${isDarkMode ? 'bg-amber-950 text-amber-400 group-hover:bg-amber-600 group-hover:text-white' : 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white'}`}>
                   <Settings size={28} />
                 </div>
                 <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Configurações</h3>
                 <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Ajuste turnos, horários de aula, limites de carga horária e parâmetros globais do sistema.</p>
               </button>
             )}
           </div>
        )}

        {/* ABA: MASTER GRID */}
        {adminTab === 'master_grid' && ['admin','gestao'].includes(userRole) && (
           <MasterGrid
              isDarkMode={isDarkMode}
              subjectHoursMeta={subjectHoursMeta}
              {...props}
           />
        )}

        

        {/* ABA: GESTÃO ESCOLAR */}
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

