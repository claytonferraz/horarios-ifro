"use client";
/* eslint-disable react-hooks/refs */
import { useData } from "@/contexts/DataContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { FloatingRequestsWidget } from './ui/admin/FloatingRequestsWidget';
import { TeacherRequestsSection } from './ui/teacher/TeacherRequestsSection';
import { MultiSelect } from "./ui/MultiSelect";
import { SearchableSelect } from "./ui/SearchableSelect";
import { InlineInput } from "./ui/InlineInput";
import { AdminStatsPanel } from "./ui/AdminStatsPanel";
import { apiClient } from "@/lib/apiClient";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminActions } from '../hooks/useAdminActions';
import { useSecurityActions } from '../hooks/useSecurityActions';
import { useScheduleView } from '../hooks/useScheduleView';
import { handlePrint } from '../utils/pdfExport';
import { ScheduleConfigPanel } from './ui/admin/ScheduleConfigPanel';
import { AcademicWeeksPanel } from './ui/admin/AcademicWeeksPanel';
import { GlobalModals } from './ui/GlobalModals';

import { PublicHome } from './areas/PublicHome';
import { AlunoView } from './areas/AlunoView';
import { ProfessorView } from './areas/ProfessorView';
import { GestaoHorarios } from './areas/GestaoHorarios';

// Utility for fetching status data internally inside the generic view
import { Calendar, Upload, Clock, BookOpen, Users, ChevronDown, FileText, AlertCircle, Trash2, UserCircle, BarChart3, Lock, Unlock, X, AlertTriangle, Settings, ShieldCheck, Power, Database, Edit3, Check, Download, Eye, Layers, Home, GraduationCap, UserCheck, Printer, ListTodo, KeyRound, CheckCircle, Link as LinkIcon, Loader2, Sun, Moon, Menu, UserPlus, ClipboardList, CalendarDays } from 'lucide-react';


// ==========================================
// FUNÇÕES UTILITÁRIAS GLOBAIS
// ==========================================
import { DAYS, MAP_DAYS, getWeekBoundaries, isDatePastOrToday, isTeacherPending, getColorHash, isCurrentWeek, isNextWeek, isFutureWeek, isCurrentOrNextWeek, parseRecordDate } from "@/lib/dates";
// ==========================================
// APLICAÇÃO PRINCIPAL
// ==========================================
export function HomeApp({ appMode }) {
  const { rawData, setRawData, disabledWeeks, setDisabledWeeks, disciplinesMeta, academicYearsMeta, subjectHoursMeta, loadAdminMetadata, refreshData, academicWeeks, activeDays, classTimes, bimesters, intervals } = useData();
  const { isDarkMode } = useTheme();
  const { isUnlocked, userRole, siape, userName, isLoadingAuth, login, logout } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  
  const rawDataRef = useRef(rawData);
  const [uploadType, setUploadType] = useState('padrao'); 

  const security = useSecurityActions({ isUnlocked, login });
  const adminActions = useAdminActions({
    rawData, setRawData, rawDataRef, disabledWeeks, setDisabledWeeks, refreshData, setErrorMsg: security.setErrorMsg, uploadType
  });

  const [adminTab, setAdminTab] = useState('planilhas');
  const [adminFilterCourses, setAdminFilterCourses] = useState([]);
  const [adminFilterClasses, setAdminFilterClasses] = useState([]);

  const scheduleState = useScheduleView({
    appMode, rawData, disabledWeeks, targetData: null, disciplinesMeta, subjectHoursMeta, adminFilterCourses, adminFilterClasses, setAdminFilterClasses, activeDays, classTimes, bimesters, siape, userRole, academicWeeks
  });

  const navigateTo = (mode) => {
    if (mode === 'home') { router.push('/'); setMobileMenuOpen(false); }
    else if (mode === 'aluno') { scheduleState.setViewMode('hoje'); scheduleState.setScheduleMode('oficial'); router.push('/aluno'); setMobileMenuOpen(false); } 
    else if (mode === 'professor') { scheduleState.setViewMode('professor'); scheduleState.setScheduleMode('oficial'); router.push('/professor'); setMobileMenuOpen(false); } 
    else if (mode === 'admin') { router.push('/admin'); setAdminTab('planilhas'); setMobileMenuOpen(false); }
  };

  const executePrint = React.useCallback(() => {
    let weekStr = scheduleState.selectedWeek;
    if (academicWeeks && scheduleState.selectedWeek && scheduleState.scheduleMode !== 'padrao') {
        const w = academicWeeks.find(week => String(week.id) === String(scheduleState.selectedWeek));
        if (w) {
            const fmtDate = (d) => {
                if (!d) return '';
                const parts = d.split('T')[0].split('-');
                return parts.length === 3 ? parts[2] + '/' + parts[1] : d;
            };
            weekStr = String(w.name).replace(/semana\s*/i, 'SEMANA ') + ' (' + fmtDate(w.start_date) + ' a ' + fmtDate(w.end_date) + ')';
        }
    }
  
    handlePrint({
      appMode: appMode,
      scheduleMode: scheduleState.scheduleMode,
      viewMode: scheduleState.viewMode,
      selectedClass: scheduleState.selectedClass,
      selectedDay: scheduleState.selectedDay,
      selectedTeacher: scheduleState.selectedTeacher,
      selectedWeek: weekStr
    });
  }, [academicWeeks, appMode, scheduleState.selectedWeek, scheduleState.scheduleMode, scheduleState.viewMode, scheduleState.selectedClass, scheduleState.selectedDay, scheduleState.selectedTeacher]);

  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      <input type="file" ref={adminActions.compareInputRef} className="hidden" accept=".csv" onChange={adminActions.handleCompareFileChange} />

      <GlobalModals 
        isDarkMode={isDarkMode}
        {...security}
        {...adminActions}
        uploadType={uploadType}
        academicWeeks={academicWeeks}
        onGoToConfig={() => { setAdminTab('configuracoes'); }}
      />


      <main className="flex-1 w-full max-w-none px-2 sm:px-6 mx-auto mt-2 space-y-4">
        {security.errorMsg && !security.authModal.show && !security.pwdModal.show && !adminActions.importUrlModal.show && !adminActions.conflictModal.show && !adminActions.deleteModal.show && (
          <div className={`border-l-4 p-2 flex items-center justify-between shadow-sm px-4 md:px-6 text-xs font-bold animate-in slide-in-from-top-2 rounded-r-lg ${isDarkMode ? 'bg-red-900/20 border-red-500 text-red-300' : 'bg-red-50 border-red-500 text-red-800'}`}>
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" /><p>{security.errorMsg}</p>
            </div>
            <button onClick={() => security.setErrorMsg('')} className={`ml-4 ${isDarkMode ? 'text-red-400 hover:text-red-200' : 'text-red-600 hover:text-red-900'}`}><X size={14} /></button>
          </div>
        )}

        {appMode === 'home' && <PublicHome isDarkMode={isDarkMode} navigateTo={navigateTo} />}

        {appMode === 'admin' && (!isUnlocked || userRole !== 'admin') && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 mt-10 mb-20 animate-in zoom-in">
             {isLoadingAuth ? (
               <div className="flex flex-col items-center justify-center opacity-50 py-10">
                 <Loader2 size={48} className="animate-spin mb-4" />
                 <p className="font-bold uppercase tracking-widest text-xs">Verificando Credenciais...</p>
               </div>
             ) : (
               <>
                 <div className={`p-8 rounded-full mb-6 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                    <Lock size={64} />
                 </div>
                 <h2 className={`text-2xl md:text-3xl font-black uppercase tracking-widest mb-4 text-center ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Acesso Restrito</h2>
                 <p className={`mb-8 font-medium text-center max-w-md ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Você precisa estar autenticado como <b>Administrador</b> para acessar a gestão do sistema.</p>
                 {!isUnlocked ? (
                   <button onClick={() => security.setAuthModal({ show: true, pendingAction: null, mode: 'login' })} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 active:scale-95 w-full max-w-xs">
                     <Unlock size={20}/> Fazer Login
                   </button>
                 ) : (
                   <button onClick={logout} className="px-8 py-4 bg-slate-600 hover:bg-slate-700 text-white font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 active:scale-95 w-full max-w-xs">
                     Sair
                   </button>
                 )}
               </>
             )}
          </div>
        )}

        {appMode === 'admin' && isUnlocked && userRole === 'admin' && (
            <>
                <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print print:hidden">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl text-white shadow-md transition-all bg-slate-800 rotate-3`}>
                            <Settings size={24}/>
                        </div>
                        <div>
                            <h1 className={`text-lg md:text-xl font-black leading-tight uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                Gestão de Banco de Dados
                            </h1>
                            <p className={`text-[10px] md:text-xs font-bold mt-0.5 uppercase tracking-widest opacity-80 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                Painel Administrativo
                            </p>
                        </div>
                    </div>
                
                    <div className="flex items-center gap-2">
                        {/* Removed Segurança Button as requested */}
                        <button onClick={() => { router.push('/professor'); }} className={`px-4 py-2.5 border rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-sm transition-all ${isDarkMode ? 'bg-indigo-900/20 text-indigo-400 border-indigo-800/50 hover:bg-indigo-900/40' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'}`}>
                            <UserCheck size={14} /> Portal do Professor
                        </button>
                        <button onClick={() => logout()} className={`px-4 py-2.5 border rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-sm transition-all ${isDarkMode ? 'bg-rose-900/20 text-rose-400 border-rose-800/50 hover:bg-rose-900/40' : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'}`}>
                        <Power size={14} /> Sair
                        </button>
                    </div>
                </div>
            
                <GestaoHorarios 
                    {...scheduleState}
                    {...adminActions}
                    isDarkMode={isDarkMode}
                    adminTab={adminTab} setAdminTab={setAdminTab}
                    userRole={userRole}
                    uploadType={uploadType} setUploadType={setUploadType}
                    subjectHoursMeta={subjectHoursMeta} loadAdminMetadata={loadAdminMetadata}
                    academicYearsMeta={academicYearsMeta}
                    adminFilterCourses={adminFilterCourses} setAdminFilterCourses={setAdminFilterCourses}
                    adminFilterClasses={adminFilterClasses} setAdminFilterClasses={setAdminFilterClasses}
                    handlePrint={executePrint} getColorHash={getColorHash} isTeacherPending={isTeacherPending}
                />
            </>
        )}

        {appMode === 'aluno' && (
            <>
                <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print print:hidden">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl text-white shadow-md transition-all bg-emerald-600`}>
                            <GraduationCap size={24}/>
                        </div>
                        <div>
                            <h1 className={`text-lg md:text-xl font-black leading-tight uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                Portal do Aluno
                            </h1>
                            <p className={`text-[10px] md:text-xs font-bold mt-0.5 uppercase tracking-widest opacity-80 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                {`${new Set(scheduleState.activeData.filter(r=>r.type==='oficial').map(r=>r.week)).size} Semanas Consolidadas Ativas`}
                            </p>
                        </div>
                    </div>
                </div>
                <AlunoView 
                    appMode="aluno" isDarkMode={isDarkMode}
                    userRole={userRole} rawData={rawData} loadAdminMetadata={loadAdminMetadata}
                    intervals={intervals}
                    {...scheduleState}
                    handlePrint={executePrint} getColorHash={getColorHash} isTeacherPending={isTeacherPending}
                />
            </>
        )}

        {appMode === 'professor' && (
            <>
                <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print print:hidden">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl text-white shadow-md transition-all bg-indigo-600`}>
                            <UserCheck size={24}/>
                        </div>
                        <div>
                            <h1 className={`text-lg md:text-xl font-black leading-tight uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                Portal do Professor
                            </h1>
                            <p className={`text-[10px] md:text-xs font-bold mt-0.5 uppercase tracking-widest opacity-80 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                {`${new Set(scheduleState.activeData.filter(r=>r.type==='oficial').map(r=>r.week)).size} Semanas Consolidadas Ativas`}
                            </p>
                        </div>
                    </div>
                    {userRole === 'admin' && (
                        <button onClick={() => { setAdminTab('master_grid'); scheduleState.setScheduleMode('previa'); scheduleState.setViewMode('curso'); router.push('/admin'); }} className={`mt-4 sm:mt-0 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg shadow-sm text-[11px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 border border-amber-600/50' : 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300'}`}>
                           <Settings size={16}/> Acessar Gestão Dinâmica
                        </button>
                    )}
                </div>
                <ProfessorView 
                    appMode="professor" isDarkMode={isDarkMode}
                    userRole={userRole} rawData={rawData} loadAdminMetadata={loadAdminMetadata}
                    intervals={intervals}
                    siape={siape}
                    {...scheduleState}
                    handlePrint={executePrint} getColorHash={getColorHash} isTeacherPending={isTeacherPending}
                />
            </>
        )}
      </main>
      
      {/* HUB WIDGET FLUTUANTE GLOBAL (NOTIFICAÇÕES E SOLICITAÇÕES) */}
      {isUnlocked && !(appMode === 'admin' && adminTab === 'master_grid') && (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse items-end group print:hidden">
           {/* Notificações e Avisos (Base da Pilha) */}
           <div className="pointer-events-auto">
             <FloatingRequestsWidget isDarkMode={isDarkMode} userRole={userRole} appMode={appMode} />
           </div>

           {/* Opções extras que aparecem no Hover */}
           <div className="mb-3 opacity-0 translate-y-10 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto">
             {appMode === 'professor' && scheduleState.viewMode !== 'solicitacoes' && (
               <TeacherRequestsSection 
                  isFloating={true} 
                  apiClient={apiClient}
                  isDarkMode={isDarkMode}
                  siape={siape}
                  selectedWeek={scheduleState.selectedWeek}
                  weekData={scheduleState.recordsForWeek ? scheduleState.recordsForWeek.filter(r => String(r.teacherId).includes(String(siape))) : []}
                  activeDays={scheduleState.activeDays}
                  classTimes={scheduleState.classTimes}
                  onCancel={() => {}}
               />
             )}
           </div>
        </div>
      )}
      
    </div>
  );
}