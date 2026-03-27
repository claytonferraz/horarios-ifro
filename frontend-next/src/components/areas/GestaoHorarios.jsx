import React, { useTransition } from 'react';
import { 
  Upload, Link as LinkIcon, FileText, Trash2,
  MessageSquare, Clock, CheckCircle2, XCircle, Send, AlertCircle,
  Database, ClipboardList, Settings, Home, Calendar, Users, Cpu
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
import { CommandCenterDashboard } from '../ui/admin/CommandCenterDashboard';


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
  navigateTo,
  ...props
}) {
  const { academicWeeks, activeDays } = useData();
  const [isPending, startTransition] = useTransition();

  const handleTabChange = (newTab) => {
    if (typeof setAdminTab === 'function') {
      startTransition(() => {
        setAdminTab(newTab);
      });
    }
  };

  return (
    <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
        {isPending && <div className="top-loading-bar" />}

        
        <div className="print:hidden">
            <AdminStatsPanel adminStats={adminStats} isDarkMode={isDarkMode} />
        </div>

        {/* BARRA DE NAVEGAÇÃO INTERNA ADMIN (REFINADA) */}
        <div className={`flex flex-wrap items-center gap-2 p-1.5 rounded-xl shadow-inner w-full mb-4 print:hidden ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
          
          <button onClick={() => handleTabChange('dashboard')} 
                  className={`px-6 py-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${adminTab === 'dashboard' ? 'bg-slate-700 text-white shadow-lg' : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100')}`}>
            <Home size={16} /> Painel Administrador
          </button>

        </div>

        <div className={isPending ? "page-transition-blur" : "transition-all duration-300"}>

        {/* ABA 4: CONFIGURAÇÕES DE HORÁRIOS */}
        {adminTab === 'configuracoes' && ['admin','gestao'].includes(userRole) && (
          <div className="space-y-6">
            <ScheduleConfigPanel isDarkMode={isDarkMode} />
          </div>
        )}

        {/* DASHBOARD INICIAL ADMIN - ATALHOS */}
        {adminTab === 'dashboard' && (
           <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in duration-500 px-4 md:px-8">
             
             {/* Card 1: Gestão Escolar */}
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

             {/* Card 6: Gestão de Servidores */}
             {['admin'].includes(userRole) && (
               <button onClick={() => navigateTo('servidores')} 
                       className={`group p-8 rounded-[2.5rem] border text-left transition-all hover:scale-[1.02] active:scale-95 ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10' : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-2xl hover:shadow-indigo-500/5'}`}>
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${isDarkMode ? 'bg-indigo-950 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                   <Users size={28} />
                 </div>
                 <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Gestão de Servidores</h3>
                 <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Gerencie o cadastro de professores e técnicos, permissões de acesso e dados funcionais.</p>
               </button>
             )}

             {/* Card 7: Fonte de Dados (SUAP) */}
             {['admin'].includes(userRole) && (
               <button onClick={() => navigateTo('dados')} 
                       className={`group p-8 rounded-[2.5rem] border text-left transition-all hover:scale-[1.02] active:scale-95 ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-rose-500/50 hover:shadow-2xl hover:shadow-rose-500/10' : 'bg-white border-slate-200 hover:border-rose-300 hover:shadow-2xl hover:shadow-rose-500/5'}`}>
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${isDarkMode ? 'bg-rose-950 text-rose-400 group-hover:bg-rose-600 group-hover:text-white' : 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white'}`}>
                   <Cpu size={28} />
                 </div>
                 <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Fonte de Dados</h3>
                 <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Configuração de integração via API com o SUAP e importação de dados acadêmicos externos.</p>
               </button>
             )}
            </div>
           </div>
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

      </div>
    </div>
  );
}
