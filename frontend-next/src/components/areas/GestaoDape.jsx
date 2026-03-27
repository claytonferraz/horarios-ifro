import React, { useState } from 'react';
import { 
  MessageSquare, CalendarDays, BarChart3, LayoutDashboard
} from 'lucide-react';
import { MasterGrid } from '../ui/admin/MasterGrid';
import { AdminRequestsManager } from '../ui/admin/AdminRequestsManager';
import { AdminTotalControl } from '../ui/admin/AdminTotalControl';
import { CommandCenterDashboard } from '../ui/admin/CommandCenterDashboard';
import { useData } from '@/contexts/DataContext';

/**
 * GestaoDape - New Area for Operational Management
 * Tabs: Dashboard, Solicitações, Montar Horário, Controle de Aulas
 */
export function GestaoDape({
  isDarkMode,
  userRole,
  ...props
}) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { globalTeachers, bimesters, academicWeeks } = useData();

  // Props needed for AdminTotalControl (inherited from PortalView context)
  const {
      diarioStats,
      finalFilteredTotalData,
      bimestresData,
      availableYearsForTotal,
      totalFilterYear,
      setTotalFilterYear,
      availableTeachersForTotal,
      totalFilterTeacher,
      setTotalFilterTeacher,
      availableClassesForTotal,
      totalFilterClass,
      setTotalFilterClass,
      availableSubjectsForTotal,
      totalFilterSubject,
      setTotalFilterSubject,
      handlePrint
  } = props;

  return (
    <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
      
      {/* Header with Title and Tab Navigation */}
      <div className={`p-4 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <LayoutDashboard size={24} />
            </div>
            <div>
              <h1 className={`text-2xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}> Gestão DAPE</h1>
              <p className={`text-[10px] font-bold uppercase tracking-widest opacity-60 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Painel Operacional da Coordenação</p>
            </div>
          </div>
        </div>

        <div className={`flex flex-wrap items-center gap-2 p-1 rounded-xl w-full ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 sm:flex-none px-6 py-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-white')}`}
          >
            <LayoutDashboard size={16} /> Dashboard
          </button>

          <button 
            onClick={() => setActiveTab('solicitacoes')}
            className={`flex-1 sm:flex-none px-6 py-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'solicitacoes' ? 'bg-rose-600 text-white shadow-lg' : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-white')}`}
          >
            <MessageSquare size={16} /> Solicitações
          </button>
          
          <button 
            onClick={() => setActiveTab('master_grid')}
            className={`flex-1 sm:flex-none px-6 py-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'master_grid' ? 'bg-indigo-600 text-white shadow-lg' : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-white')}`}
          >
            <CalendarDays size={16} /> Montar Horário
          </button>

          <button 
            onClick={() => setActiveTab('controle_aulas')}
            className={`flex-1 sm:flex-none px-6 py-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'controle_aulas' ? 'bg-amber-600 text-white shadow-lg' : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-white')}`}
          >
            <BarChart3 size={16} /> Controle de Aulas
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="animate-in fade-in duration-500">
        {activeTab === 'dashboard' && (
          <CommandCenterDashboard 
            isDarkMode={isDarkMode} 
            mappedSchedules={props.mappedSchedules}
            finalFilteredTotalData={finalFilteredTotalData}
            classesList={props.classesList || []}
          />
        )}
        {activeTab === 'solicitacoes' && <AdminRequestsManager isDarkMode={isDarkMode} />}
        
        {activeTab === 'master_grid' && (
          <MasterGrid 
            isDarkMode={isDarkMode} 
            {...props} 
          />
        )}

        {activeTab === 'controle_aulas' && (
          <AdminTotalControl
            isDarkMode={isDarkMode}
            diarioStats={diarioStats}
            finalFilteredTotalData={finalFilteredTotalData}
            bimestresData={bimestresData}
            availableYearsForTotal={availableYearsForTotal}
            totalFilterYear={totalFilterYear}
            setTotalFilterYear={setTotalFilterYear}
            availableTeachersForTotal={availableTeachersForTotal}
            totalFilterTeacher={totalFilterTeacher}
            setTotalFilterTeacher={setTotalFilterTeacher}
            availableClassesForTotal={availableClassesForTotal}
            totalFilterClass={totalFilterClass}
            setTotalFilterClass={setTotalFilterClass}
            availableSubjectsForTotal={availableSubjectsForTotal}
            totalFilterSubject={totalFilterSubject}
            setTotalFilterSubject={setTotalFilterSubject}
            globalTeachers={globalTeachers}
            bimesters={bimesters}
            academicWeeks={academicWeeks}
            handlePrint={handlePrint}
            hideTeacherFilter={false} // Admin view show show all teachers
          />
        )}
      </div>
    </div>
  );
}
