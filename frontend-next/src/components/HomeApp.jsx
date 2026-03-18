
"use client";
/* eslint-disable react-hooks/refs */
import { useData } from "@/contexts/DataContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { MultiSelect } from "./ui/MultiSelect";
import { SearchableSelect } from "./ui/SearchableSelect";
import { InlineInput } from "./ui/InlineInput";
import { AdminStatsPanel } from "./ui/AdminStatsPanel";
import { apiClient } from "@/lib/apiClient";
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  const { rawData, setRawData, disabledWeeks, setDisabledWeeks, disciplinesMeta, academicYearsMeta, subjectHoursMeta, loadAdminMetadata, refreshData, academicWeeks, activeDays, classTimes, bimesters } = useData();
  const { isDarkMode } = useTheme();
  const { isUnlocked, userRole, login, logout, changePassword } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
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
    appMode, rawData, disabledWeeks, targetData: null, disciplinesMeta, subjectHoursMeta, adminFilterCourses, adminFilterClasses, setAdminFilterClasses, activeDays, classTimes, bimesters
  });

  const navigateTo = (mode) => {
    if (mode === 'home') { window.location.href = "/"; setMobileMenuOpen(false); }
    else if (mode === 'aluno') { scheduleState.setViewMode('hoje'); scheduleState.setScheduleMode('oficial'); window.location.href = "/aluno"; setMobileMenuOpen(false); } 
    else if (mode === 'professor') { scheduleState.setViewMode('professor'); scheduleState.setScheduleMode('padrao'); window.location.href = "/professor"; setMobileMenuOpen(false); } 
    else if (mode === 'admin') { window.location.href = "/admin"; setAdminTab('planilhas'); setMobileMenuOpen(false); }
  };

  const executePrint = () => {
    handlePrint({
      scheduleMode: scheduleState.scheduleMode,
      viewMode: scheduleState.viewMode,
      selectedClass: scheduleState.selectedClass,
      selectedDay: scheduleState.selectedDay,
      selectedTeacher: scheduleState.selectedTeacher,
      selectedWeek: scheduleState.selectedWeek
    });
  };

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


      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 lg:px-6 mt-2 space-y-4">
        {security.errorMsg && !security.authModal.show && !security.pwdModal.show && !adminActions.importUrlModal.show && !adminActions.conflictModal.show && !adminActions.deleteModal.show && (
          <div className={`border-l-4 p-2 flex items-center justify-between shadow-sm px-4 md:px-6 text-xs font-bold animate-in slide-in-from-top-2 rounded-r-lg ${isDarkMode ? 'bg-red-900/20 border-red-500 text-red-300' : 'bg-red-50 border-red-500 text-red-800'}`}>
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" /><p>{security.errorMsg}</p>
            </div>
            <button onClick={() => security.setErrorMsg('')} className={`ml-4 ${isDarkMode ? 'text-red-400 hover:text-red-200' : 'text-red-600 hover:text-red-900'}`}><X size={14} /></button>
          </div>
        )}

        {appMode === 'home' && <PublicHome isDarkMode={isDarkMode} navigateTo={navigateTo} />}

        {appMode === 'admin' && !isUnlocked && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 mt-10 mb-20 animate-in zoom-in">
             <div className={`p-8 rounded-full mb-6 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                <Lock size={64} />
             </div>
             <h2 className={`text-2xl md:text-3xl font-black uppercase tracking-widest mb-4 text-center ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Acesso Restrito</h2>
             <p className={`mb-8 font-medium text-center max-w-md ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Você precisa estar autenticado como administrador para acessar o painel de controle.</p>
             <button onClick={() => security.setAuthModal({ show: true, pendingAction: null, mode: 'login' })} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 active:scale-95 w-full max-w-xs">
               <Unlock size={20}/> Fazer Login
             </button>
          </div>
        )}

        {appMode === 'admin' && isUnlocked && (
            <>
                <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
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
                        {userRole === 'admin' && (
                        <button onClick={() => {
                            security.setSecurityTab('password');
                            security.setPwdModal({ show: true, current: '', newPwd: '', confirm: '', error: '', success: '' });
                        }} className={`px-4 py-2.5 border rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-sm transition-all ${isDarkMode ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                            <KeyRound size={14} className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} /> Segurança
                        </button>
                        )}
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
                />
            </>
        )}

        {appMode === 'aluno' && (
            <>
                <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
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
                    {...scheduleState}
                    handlePrint={executePrint} getColorHash={getColorHash} isTeacherPending={isTeacherPending}
                />
            </>
        )}

        {appMode === 'professor' && (
            <>
                <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
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
                </div>
                <ProfessorView 
                    appMode="professor" isDarkMode={isDarkMode}
                    {...scheduleState}
                    handlePrint={executePrint} getColorHash={getColorHash} isTeacherPending={isTeacherPending}
                />
            </>
        )}
      </main>
      
    </div>
  );
}