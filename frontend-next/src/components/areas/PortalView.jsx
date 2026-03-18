import React, { useState } from 'react';
import { 
  Calendar, Layers, UserCircle, AlertTriangle, BarChart3, ListTodo,
  ChevronDown, Clock, Printer, CheckCircle, Eye, BookOpen, FileText, Users
} from 'lucide-react';
import { SearchableSelect } from '../ui/SearchableSelect';
import { InlineInput } from '../ui/InlineInput';
import { ScheduleEditorModal } from '../ui/admin/ScheduleEditorModal';
import { MAP_DAYS, getColorHash, isTeacherPending, resolveTeacherName } from '@/lib/dates';
import { useData } from '@/contexts/DataContext';

export function PortalView({
  appMode, isDarkMode, viewMode, setViewMode, scheduleMode, setScheduleMode, userRole,
  selectedCourse, setSelectedCourse, selectedClass, setSelectedClass, selectedTeacher, setSelectedTeacher,
  totalFilterYear, setTotalFilterYear, totalFilterTeacher, setTotalFilterTeacher, totalFilterClass, setTotalFilterClass, totalFilterSubject, setTotalFilterSubject,
  courses, classesList, globalTeachersList, availableYearsForTotal, availableTeachersForTotal, availableClassesForTotal, availableSubjectsForTotal,
  alunoStats, diarioStats, finalFilteredTotalData, bimestresData, recordsForWeek,
  activeData, handlePrint, getColorHash, isTeacherPending,
  selectedDay, setSelectedDay, selectedWeek, setSelectedWeek, activeWeeksList,
  getCellRecords, activeCourseClasses, profStats, activeDays, classTimes, rawData, loadAdminMetadata
}) {
  const { globalTeachers } = useData();
  const [editorModal, setEditorModal] = useState(null);

  const safeDays = [...(activeDays || ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'])].sort((a,b) => MAP_DAYS.indexOf(a) - MAP_DAYS.indexOf(b));
  const shiftOrder = { 'Matutino': 1, 'Vespertino': 2, 'Noturno': 3 };
  const safeTimes = [...(classTimes || [])].sort((a, b) => {
    const shiftA = typeof a === 'object' ? a.shift : '';
    const shiftB = typeof b === 'object' ? b.shift : '';
    const orderA = shiftOrder[shiftA] || 99;
    const orderB = shiftOrder[shiftB] || 99;
    
    if (orderA !== orderB) return orderA - orderB;
    
    const timeA = typeof a === 'object' ? a.timeStr : a;
    const timeB = typeof b === 'object' ? b.timeStr : b;
    return timeA.localeCompare(timeB);
  });
  const getFormattedDayLabel = (dayName) => {
    if (scheduleMode === 'padrao') return dayName;
    if (!selectedWeek || typeof selectedWeek !== 'string' || !selectedWeek.includes(' a ')) return dayName;
    const [startStr] = selectedWeek.split(' a ');
    if (!startStr || !startStr.includes('/')) return dayName;
    
    const [d, m] = startStr.split('/');
    if (!d || !m) return dayName;
    
    const baseDate = new Date(new Date().getFullYear(), parseInt(m) - 1, parseInt(d), 12, 0, 0);
    const dayIndexInWeek = MAP_DAYS.indexOf(dayName) - 1;
    if (dayIndexInWeek < 0) return dayName;
    
    const targetDate = new Date(baseDate);
    targetDate.setDate(targetDate.getDate() + dayIndexInWeek);
    
    const dayFormatted = String(targetDate.getDate()).padStart(2, '0');
    const monthFormatted = String(targetDate.getMonth() + 1).padStart(2, '0');
    return `${dayFormatted}/${monthFormatted} - ${dayName.split('-')[0]}`;
  };

  const [mobileSelectedClasses, setMobileSelectedClasses] = React.useState({});

  React.useEffect(() => {
    if (viewMode === 'hoje' && scheduleMode !== 'padrao' && selectedWeek) {
      const [startStr] = selectedWeek.split(' a ');
      if (startStr && startStr.includes('/')) {
        const [d, m] = startStr.split('/');
        const weekStart = new Date(new Date().getFullYear(), parseInt(m) - 1, parseInt(d), 12, 0, 0);
        // Remove times to compare accurate day difference
        weekStart.setHours(0,0,0,0);
        const today = new Date();
        today.setHours(0,0,0,0);
        const diffInTime = Math.floor((today.getTime() - weekStart.getTime()) / (1000 * 3600 * 24));
        
        if (diffInTime < 0 || diffInTime > 6) {
          if (safeDays.includes('Segunda-feira')) {
            setSelectedDay('Segunda-feira');
          } else if (safeDays.length > 0) {
            setSelectedDay(safeDays[0]);
          }
        }
      }
    }
  }, [selectedWeek, viewMode, scheduleMode]);

  return (
    <>
        {activeData.length === 0 ? (
            <div className={`rounded-2xl border p-12 text-center shadow-sm animate-in fade-in ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <Calendar size={40} className={`mx-auto mb-4 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
              <h3 className={`text-lg font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Nenhuma Planilha Disponível</h3>
              <p className={`text-sm font-medium mt-2 max-w-md mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Ainda não há dados cadastrados no sistema. Aguarde a atualização pela coordenação.
              </p>
            </div>
          ) : (
          <div className="space-y-4 animate-in fade-in duration-700">
            
            {/* ABAS E FILTROS */}
            <div className={`rounded-2xl shadow-sm border p-4 space-y-4 no-print ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              
              {/* Nível 1: Tipos de Visão (Adaptável por Perfil) */}
              <div className={`flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border-b pb-3 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                <div className={`flex flex-wrap p-1 rounded-xl shadow-inner w-full lg:w-auto overflow-hidden ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
                  {appMode === 'professor' && (
                    <>
                      <button onClick={() => setViewMode('professor')} className={`flex-1 min-w-[80px] md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'professor' ? (isDarkMode ? 'bg-slate-700 text-indigo-400 shadow-sm' : 'bg-white text-indigo-700 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}><UserCircle size={14} /> Meu Horário</button>
                      <button onClick={() => setViewMode('curso')} className={`flex-1 min-w-[80px] md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'curso' ? (isDarkMode ? 'bg-slate-700 text-rose-400 shadow-sm' : 'bg-white text-rose-700 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}><Layers size={14} /> Horário dos Cursos</button>
                      <div className={`w-px mx-0.5 hidden lg:block ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                      <button onClick={() => setViewMode('sem_professor')} className={`flex-1 min-w-[80px] md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'sem_professor' ? (isDarkMode ? 'bg-slate-700 text-red-400 shadow-sm' : 'bg-white text-red-700 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}><AlertTriangle size={14} /> Aulas Vagas</button>
                      <button onClick={() => setViewMode('total')} className={`flex-1 min-w-[80px] md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'total' ? (isDarkMode ? 'bg-slate-700 text-amber-400 shadow-sm' : 'bg-white text-amber-700 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}><BarChart3 size={14} /> Controle de Aulas</button>
                    </>
                  )}
                  {appMode === 'aluno' && (
                    <>
                      <button onClick={() => setViewMode('hoje')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'hoje' ? (isDarkMode ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-blue-700 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}><ListTodo size={14} /> Horário do Dia</button>
                      <button onClick={() => setViewMode('turma')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'turma' ? (isDarkMode ? 'bg-slate-700 text-emerald-400 shadow-sm' : 'bg-white text-emerald-700 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}><Calendar size={14} /> Grade da Semana</button>
                      <button onClick={() => setViewMode('professor')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'professor' ? (isDarkMode ? 'bg-slate-700 text-indigo-400 shadow-sm' : 'bg-white text-indigo-700 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}><UserCircle size={14} /> Professor</button>
                    </>
                  )}
                </div>
              </div>

              {/* Filtros Específicos para renderização */}
              {viewMode !== 'curso' && viewMode !== 'sem_professor' && (
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 rounded-xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                  {(viewMode === 'turma' || viewMode === 'hoje') && (
                    <>
                      <div className="space-y-1 lg:col-span-2"><label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1">Filtrar por Curso</label>
                        <SearchableSelect isDarkMode={isDarkMode} options={courses} value={selectedCourse} onChange={setSelectedCourse} colorClass={isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-sm' : 'bg-white border-slate-200 text-slate-700 shadow-sm'} />
                      </div>
                      <div className="space-y-1 lg:col-span-2"><label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1">Visualizar Turma</label>
                        <SearchableSelect isDarkMode={isDarkMode} options={classesList} value={selectedClass} onChange={setSelectedClass} colorClass={scheduleMode === 'previa' ? (isDarkMode ? "bg-violet-900/30 border-violet-800/50 text-violet-200 shadow-sm" : "bg-violet-50 border-violet-100 text-violet-900 shadow-sm") : viewMode === 'hoje' ? (isDarkMode ? "bg-blue-900/30 border-blue-800/50 text-blue-200 shadow-sm" : "bg-blue-50 border-blue-100 text-blue-900 shadow-sm") : (isDarkMode ? "bg-emerald-900/30 border-emerald-800/50 text-emerald-200 shadow-sm" : "bg-emerald-50 border-emerald-100 text-emerald-900 shadow-sm")} />
                      </div>
                    </>
                  )}
                  {(viewMode === 'professor') && (
                    <div className="space-y-1 col-span-full md:col-span-2"><label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1">Buscar Professor</label>
                      <SearchableSelect isDarkMode={isDarkMode} options={globalTeachersList.map(t => ({value: t, label: resolveTeacherName(t, globalTeachers)}))} value={selectedTeacher} onChange={setSelectedTeacher} colorClass={isDarkMode ? "bg-indigo-900/30 border-indigo-800/50 text-indigo-200 shadow-sm" : "bg-indigo-50 border-indigo-100 text-indigo-900 shadow-sm"} />
                    </div>
                  )}
                  {viewMode === 'total' && (
                    <>
                      <div className="space-y-1"><label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1">Ano Letivo</label>
                        <SearchableSelect isDarkMode={isDarkMode} options={availableYearsForTotal} value={totalFilterYear} onChange={setTotalFilterYear} colorClass={isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-sm' : 'bg-white border-slate-200 text-slate-800 shadow-sm'} />
                      </div>
                      <div className="space-y-1"><label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1">Professor</label>
                        <SearchableSelect isDarkMode={isDarkMode} options={availableTeachersForTotal.map(t => ({value: t, label: resolveTeacherName(t, globalTeachers)}))} value={totalFilterTeacher} onChange={setTotalFilterTeacher} colorClass={isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-sm' : 'bg-white border-slate-200 text-slate-800 shadow-sm'} />
                      </div>
                      <div className="space-y-1"><label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1">Turma</label>
                        <SearchableSelect isDarkMode={isDarkMode} options={availableClassesForTotal} value={totalFilterClass} onChange={setTotalFilterClass} colorClass={isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-sm' : 'bg-white border-slate-200 text-slate-800 shadow-sm'} />
                      </div>
                      <div className="space-y-1"><label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1">Disciplina</label>
                        <SearchableSelect isDarkMode={isDarkMode} options={availableSubjectsForTotal} value={totalFilterSubject} onChange={setTotalFilterSubject} colorClass={isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-sm' : 'bg-white border-slate-200 text-slate-800 shadow-sm'} />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ESTATÍSTICAS - PORTAL DO ALUNO */}
              {appMode === 'aluno' && (viewMode === 'turma' || viewMode === 'hoje') && selectedClass && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className={`border p-3 rounded-xl text-center shadow-sm ${isDarkMode ? 'bg-emerald-900/20 border-emerald-800/50' : 'bg-emerald-50 border-emerald-100'}`}>
                    <span className={`text-2xl font-black leading-none ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{alunoStats.lecionadas}</span>
                    <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-800/60'}`}>Aulas Já Lecionadas</p>
                  </div>
                  <div className={`border p-3 rounded-xl text-center shadow-sm ${isDarkMode ? 'bg-orange-900/20 border-orange-800/50' : 'bg-orange-50 border-orange-100'}`}>
                    <span className={`text-2xl font-black leading-none ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>{alunoStats.semProfessorSemana}</span>
                    <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-orange-300' : 'text-orange-800/60'}`}>Aulas Vagas ({scheduleMode === 'previa' ? 'prévia' : 'semana'})</p>
                  </div>
                  <div className={`border p-3 rounded-xl text-center shadow-sm ${isDarkMode ? 'bg-red-900/20 border-red-800/50' : 'bg-red-50 border-red-100'}`}>
                    <span className={`text-2xl font-black leading-none ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{alunoStats.aReporTotal}</span>
                    <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-red-300' : 'text-red-800/60'}`}>Total a repor</p>
                  </div>
                </div>
              )}

              {/* ESTATÍSTICAS - PORTAL DO PROFESSOR */}
              {(viewMode === 'professor') && selectedTeacher && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className={`border p-3 rounded-xl text-center shadow-sm ${isDarkMode ? 'bg-indigo-900/20 border-indigo-800/50' : 'bg-indigo-50 border-indigo-100'}`}>
                    <span className={`text-2xl font-black leading-none ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{profStats.dadas}</span>
                    <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-800/60'}`}>Aulas Dadas</p>
                  </div>
                  <div className={`border p-3 rounded-xl text-center shadow-sm ${isDarkMode ? 'bg-blue-900/20 border-blue-800/50' : 'bg-blue-50 border-blue-100'}`}>
                    <span className={`text-2xl font-black leading-none ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{profStats.turmas}</span>
                    <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-blue-300' : 'text-blue-800/60'}`}>Total de Turmas</p>
                  </div>
                  <div className={`border p-3 rounded-xl text-center shadow-sm ${isDarkMode ? 'bg-emerald-900/20 border-emerald-800/50' : 'bg-emerald-50 border-emerald-100'}`}>
                    <span className={`text-2xl font-black leading-none ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{profStats.semanaAtual}</span>
                    <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-800/60'}`}>Aulas nesta semana</p>
                  </div>
                </div>
              )}
            </div>

            {/* OPÇÕES DE BASE DE DADOS (Movido para perto da tabela) */}
            {viewMode !== 'total' && (
              <div className={`border p-2.5 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 mb-2 no-print ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`flex border p-1 rounded-xl w-full md:w-auto ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <button onClick={() => setScheduleMode('oficial')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scheduleMode === 'oficial' ? 'bg-emerald-500 text-white shadow-md' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}`}>
                    <Calendar size={14} /> {appMode === 'aluno' ? 'Horário da Semana' : 'Horário Consolidado'}
                  </button>
                  <button onClick={() => setScheduleMode('previa')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scheduleMode === 'previa' ? 'bg-violet-500 text-white shadow-md' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}`}>
                    <Eye size={14} /> Prévia
                  </button>
                  <button onClick={() => setScheduleMode('padrao')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scheduleMode === 'padrao' ? 'bg-blue-500 text-white shadow-md' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}`}>
                    <BookOpen size={14} /> Padrão Anual
                  </button>
                </div>

                {scheduleMode !== 'padrao' && (
                  <div className={`flex items-center w-full md:w-auto p-1 rounded-xl border min-w-[300px] ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className={`flex items-center pl-3 pr-2 gap-1.5 shrink-0 border-r mr-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                      <FileText size={14} className="text-slate-400" />
                      <span className={`text-[9px] font-bold uppercase tracking-widest hidden sm:inline ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Selecione a Semana:</span>
                    </div>
                    <SearchableSelect isDarkMode={isDarkMode} options={activeWeeksList} value={selectedWeek} onChange={setSelectedWeek} colorClass={`bg-transparent border-none font-black uppercase tracking-tighter text-[11px] ${isDarkMode ? 'text-white' : 'text-slate-900'}`} placeholder="Selecione..." />
                  </div>
                )}
              </div>
            )}

            {/* ÁREA ENCAPSULADA DE EXIBIÇÃO E IMPRESSÃO */}
            <div id="printable-area">
              
              {/* TRATAMENTO DE ESTADO VAZIO */}
              {viewMode !== 'total' && scheduleMode !== 'padrao' && activeWeeksList.length === 0 ? (
                <div className={`rounded-2xl border p-12 text-center shadow-sm no-print ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  {scheduleMode === 'previa' ? <Eye size={36} className={`mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} /> : <Calendar size={36} className={`mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />}
                  <h3 className={`text-lg font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                    {scheduleMode === 'previa' ? 'Nenhuma Prévia Disponível' : 'Nenhuma Planilha Oficial'}
                  </h3>
                  <p className={`text-sm font-medium mt-1 max-w-md mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {scheduleMode === 'previa' 
                      ? 'Não há prévias arquivadas cujas datas pertençam às próximas semanas.' 
                      : appMode === 'aluno' ? 'Nenhuma aula programada para a semana atual.' : 'Não há dados oficiais ativos no momento correspondentes à aba selecionada.'}
                  </p>
                </div>
              ) : (
                <>

                  {/* VISTA: HORÁRIO DO DIA (Alunos) - COMPACTA EM LISTA */}
                  {viewMode === 'hoje' && (
                    <div className={`rounded-2xl shadow-sm border overflow-hidden animate-in zoom-in-95 duration-500 max-w-4xl mx-auto ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <div className={`text-white px-5 py-3.5 flex items-center justify-between no-print ${isDarkMode ? 'bg-blue-950' : 'bg-blue-800'}`}>
                         <div className="flex items-center gap-2.5">
                           <ListTodo size={18} />
                           <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                             {scheduleMode === 'padrao' && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">PADRÃO</span>}
                             {scheduleMode === 'previa' && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">PRÉVIA</span>}
                             Horário do Dia: {selectedClass}
                           </h2>
                         </div>
                      </div>

                      {/* Seletor Horizontal de Dias */}
                      <div className={`flex overflow-x-auto p-1.5 border-b no-scrollbar no-print ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                         {safeDays.map(d => (
                            <button key={d} onClick={() => setSelectedDay(d)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${selectedDay === d ? 'bg-blue-500 text-white shadow-sm' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700')}`}>{getFormattedDayLabel(d)}</button>
                         ))}
                      </div>

                      <div className="p-4 md:p-6 space-y-3">
                         {(() => {
                            let currentShift = '';
                            return safeTimes.map((timeObj, index) => {
                               const time = timeObj.timeStr;
                               const shift = timeObj.shift;
                               const isNewShift = shift !== currentShift;
                               if (isNewShift) currentShift = shift;

                               const records = getCellRecords(selectedDay, time);

                               return (
                                  <React.Fragment key={`frag-${time}`}>
                                    {isNewShift && (
                                       <div className={`flex items-center gap-2 mt-4 mb-2 opacity-50 ${index === 0 ? '!mt-0' : ''}`}>
                                          <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
                                          <span className="text-[9px] font-black uppercase tracking-[0.3em]">{shift}</span>
                                          <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
                                       </div>
                                    )}
                                    <div key={time} className={`flex flex-col sm:flex-row gap-3 sm:items-center p-3 rounded-xl border transition-colors ${isDarkMode ? 'border-slate-700 bg-slate-800/30 hover:bg-slate-800/50' : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'}`}>
                                       <div className="w-32 shrink-0 text-center sm:text-left">
                                          <span className={`border font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm inline-block ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>{time}</span>
                                       </div>
                                       <div className="flex-1 space-y-2">
                                          {records.length > 0 ? records.map(r => {
                                             const isPending = isTeacherPending(r.teacher);
                                             return (
                                                <div key={r.id} className={`p-3 rounded-lg border flex flex-col sm:flex-row justify-between sm:items-center gap-2 shadow-sm ${isPending ? (isDarkMode ? 'bg-red-900/30 border-red-800/50 text-red-300' : 'bg-red-50 border-red-200 text-red-800') : getColorHash(r.subject, isDarkMode)}`}>
                                                   <div>
                                                      <p className={`font-black text-sm leading-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{r.subject}</p>
                                                      <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${isPending ? (isDarkMode ? 'text-red-400' : 'text-red-600') : 'opacity-80'}`}>{isPending ? 'Sem Professor' : resolveTeacherName(r.teacher, globalTeachers)}</p>
                                                   </div>
                                                   {r.room && <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md self-start sm:self-auto shrink-0 ${isDarkMode ? 'bg-white/10' : 'bg-black/5'}`}>{r.room}</span>}
                                                </div>
                                             )
                                          }) : <div className={`text-[10px] font-bold uppercase tracking-widest py-1.5 px-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>- Horário Vago -</div>}
                                       </div>
                                    </div>
                                  </React.Fragment>
                               );
                            });
                         })()}
                      </div>
                    </div>
                  )}


                  {/* TABELA DE CONTROLE (TOTAIS) E ESTATÍSTICAS DIÁRIO */}
                  {viewMode === 'total' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                      <div className={`rounded-2xl shadow-sm border p-4 sm:p-6 flex flex-col xl:flex-row items-center justify-between gap-4 bg-gradient-to-br no-print ${isDarkMode ? 'bg-slate-800 border-slate-700 from-slate-800 to-slate-900' : 'bg-white border-slate-200 from-white to-slate-50/50'}`}>
                        
                        <div className="flex items-center gap-4 w-full xl:w-auto">
                          <div className={`p-4 rounded-2xl text-white shadow-xl rotate-2 shrink-0 ${isDarkMode ? 'bg-amber-700 shadow-none' : 'bg-amber-600 shadow-amber-200'}`}><BarChart3 size={32}/></div>
                          <div>
                            <h2 className={`text-xl sm:text-2xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>Controle de aulas</h2>
                            <p className={`font-bold uppercase text-[9px] tracking-widest mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Visão geral oficial</p>
                          </div>
                        </div>

                        {/* GRID DE ESTATÍSTICAS */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 w-full xl:w-auto">
                          {/* Aulas Totais (Geral da query) */}
                          <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <span className={`text-xl font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{finalFilteredTotalData.length}</span>
                            <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 text-center ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Aulas Totais</span>
                          </div>

                          {/* CH Total */}
                          <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center ${isDarkMode ? 'bg-blue-900/10 border-blue-800/30' : 'bg-blue-50/50 border-blue-100'}`}>
                            <span className={`text-xl font-black ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{diarioStats.chTotal}</span>
                            <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 text-center opacity-80 ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>CH Total</span>
                          </div>
                          
                          {/* CH Ministrada */}
                          <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center ${isDarkMode ? 'bg-indigo-900/10 border-indigo-800/30' : 'bg-indigo-50/50 border-indigo-100'}`}>
                            <span className={`text-xl font-black ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{diarioStats.ministradas}</span>
                            <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 text-center opacity-80 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>CH Ministrada</span>
                          </div>

                          {/* Status de Andamento da Disciplina (Algoritmo Meta vs Tempo) */}
                          <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center 
                            ${diarioStats.status === 'atrasada' ? (isDarkMode ? 'bg-rose-900/20 border-rose-800/50' : 'bg-rose-50 border-rose-200') : 
                              diarioStats.status === 'adiantada' ? (isDarkMode ? 'bg-teal-900/20 border-teal-800/50' : 'bg-teal-50 border-teal-200') : 
                              diarioStats.status === 'em_dia' ? (isDarkMode ? 'bg-emerald-900/20 border-emerald-800/50' : 'bg-emerald-50 border-emerald-200') : 
                              (isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200')}`}>
                            <span className={`text-xl font-black 
                              ${diarioStats.status === 'atrasada' ? (isDarkMode ? 'text-rose-400' : 'text-rose-600') : 
                                diarioStats.status === 'adiantada' ? (isDarkMode ? 'text-teal-400' : 'text-teal-600') : 
                                diarioStats.status === 'em_dia' ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600') : 
                                (isDarkMode ? 'text-slate-500' : 'text-slate-400')}`}>
                              {diarioStats.status === 'indefinido' ? '-' : diarioStats.status === 'em_dia' ? 'OK' : `${diarioStats.status === 'atrasada' ? '-' : '+'}${diarioStats.diffAbs}`}
                            </span>
                            <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 text-center opacity-80 
                              ${diarioStats.status === 'atrasada' ? (isDarkMode ? 'text-rose-400' : 'text-rose-700') : 
                                diarioStats.status === 'adiantada' ? (isDarkMode ? 'text-teal-400' : 'text-teal-700') : 
                                diarioStats.status === 'em_dia' ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-700') : 
                                (isDarkMode ? 'text-slate-500' : 'text-slate-500')}`}>
                              {diarioStats.status === 'indefinido' ? 'Sem CH' : diarioStats.status === 'em_dia' ? 'Em Dia' : diarioStats.status === 'atrasada' ? 'Atrasada' : 'Adiantada'}
                            </span>
                          </div>

                          {/* Aulas SUAP */}
                          <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center ${isDarkMode ? 'bg-purple-900/10 border-purple-800/30' : 'bg-purple-50/50 border-purple-100'}`}>
                            <span className={`text-xl font-black ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>{diarioStats.suapTotal}</span>
                            <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 text-center opacity-80 ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>No SUAP</span>
                          </div>

                          {/* A Lançar */}
                          <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center ${diarioStats.aLancar > 0 ? (isDarkMode ? 'bg-rose-900/20 border-rose-800/50' : 'bg-rose-50 border-rose-200') : (isDarkMode ? 'bg-emerald-900/20 border-emerald-800/50' : 'bg-emerald-50 border-emerald-200')}`}>
                            <span className={`text-xl font-black ${diarioStats.aLancar > 0 ? (isDarkMode ? 'text-rose-400' : 'text-rose-600') : (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')}`}>
                              {diarioStats.aLancar > 0 ? `+${diarioStats.aLancar}` : diarioStats.aLancar}
                            </span>
                            <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 text-center opacity-80 ${diarioStats.aLancar > 0 ? (isDarkMode ? 'text-rose-400' : 'text-rose-700') : (isDarkMode ? 'text-emerald-400' : 'text-emerald-700')}`}>A Lançar</span>
                          </div>
                        </div>

                      </div>

                      <div className={`rounded-2xl shadow-sm border overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                         <div className={`text-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b no-print ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 border-slate-800'}`}>
                           <div className="flex items-center gap-2.5">
                             <Clock className="text-amber-500" size={20}/>
                             <h3 className="font-black uppercase tracking-widest text-xs">Diário Detalhado</h3>
                           </div>
                           <div className="flex items-center gap-3">
                             <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">Distribuição por bimestre</span>
                             <button onClick={handlePrint} className="hidden md:flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-[10px] font-black transition-all shadow-sm">
                               <Printer size={14} /> Imprimir Diário
                             </button>
                           </div>
                         </div>
                         
                         <div className="overflow-x-auto">
                           <table className="w-full border-collapse table-fixed min-w-[1000px] text-xs">
                              <thead>
                                <tr className={`text-[9px] font-black uppercase tracking-[0.2em] border-b ${isDarkMode ? 'bg-slate-900/50 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                  {[
                                    {b:1, d:"04/02 a 21/04"},
                                    {b:2, d:"22/04 a 03/07"},
                                    {b:3, d:"22/07 a 28/09"},
                                    {b:4, d:"29/09 a 10/12"}
                                  ].map(bim => (
                                    <th key={bim.b} className={`p-4 border-r last:border-0 text-center ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                                      <div className="mb-1 text-xs">{bim.b}º Bimestre</div>
                                      <div className={`text-white px-3 py-0.5 rounded-full text-[9px] inline-block font-black shadow-md uppercase tracking-tighter no-print ${isDarkMode ? 'bg-indigo-700 shadow-none' : 'bg-indigo-600 shadow-indigo-100'}`}>
                                        {bimestresData[bim.b].length} aulas
                                      </div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="align-top">
                                <tr>
                                  {[1,2,3,4].map(b => {
                                    let lastDate = "";
                                    let zebra = false;
                                    return (
                                      <td key={b} className={`p-1 border-r last:border-0 ${isDarkMode ? 'border-slate-700/50 bg-slate-800/10' : 'border-slate-100 bg-slate-50/5'}`}>
                                        <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                                          {bimestresData[b].length > 0 ? bimestresData[b].map(r => {
                                            const currentDate = `${r.date}`;
                                            if (currentDate !== lastDate) { lastDate = currentDate; zebra = !zebra; }
                                            return (
                                              <div key={r.id} className={`print-clean-card px-2.5 py-2 border-l-4 transition-all text-[10px] ${zebra ? (isDarkMode ? 'bg-slate-800 border-indigo-600 shadow-sm' : 'bg-slate-100/80 border-indigo-600 shadow-sm') : (isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200')}`}>
                                                <p className={`font-bold leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                                  <span className={`font-black ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{currentDate}</span> - {r.time.replace(' - ', ' às ')}  
                                                  <span className={`subject font-medium uppercase tracking-tighter text-[10px] ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}> - {r.subject}</span>
                                                </p>
                                              </div>
                                            );
                                          }) : (
                                            <div className={`py-16 text-center flex flex-col items-center gap-2 select-none no-print ${isDarkMode ? 'opacity-20' : 'opacity-10'}`}>
                                              <Calendar size={32} className={isDarkMode ? 'text-white' : ''} /><span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : ''}`}>Sem Registros</span>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              </tbody>
                           </table>
                         </div>
                      </div>
                    </div>
                  )}

                  {/* GRADE DE HORÁRIO (Visão Curso MATRIZ) */}
                  {viewMode === 'curso' && (
                    <div className="space-y-6 animate-in zoom-in-95 duration-500">
                      {(() => {
                        const availableCourses = courses.filter(c => c !== 'Todos').sort((a,b) => a.localeCompare(b));

                        if (availableCourses.length === 0) {
                          return (
                            <div className={`rounded-2xl border p-12 text-center shadow-sm no-print ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                              <CheckCircle size={40} className="mx-auto text-emerald-400 mb-3" />
                              <h3 className={`text-lg font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Nenhuma Aula</h3>
                              <p className={`text-sm font-medium mt-1 max-w-md mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                Não há horários cadastrados para exibir nesta semana.
                              </p>
                            </div>
                          );
                        }

                        return availableCourses.map(course => {
                          // Find all classes registered for this course in activeData to ensure no class is missed
                          const courseClassesGlobais = activeData.filter(r => r.course === course).map(r => r.className);
                          const courseClasses = [...new Set(courseClassesGlobais)].sort();
                          const courseRecords = recordsForWeek.filter(r => r.course === course);

                          if (courseClasses.length === 0) return null;

                          return (
                            <div key={course} className={`rounded-2xl shadow-sm border overflow-hidden mb-6 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                              <div className={`text-white px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print ${scheduleMode === 'padrao' ? (isDarkMode ? 'bg-blue-950' : 'bg-blue-900') : scheduleMode === 'previa' ? (isDarkMode ? 'bg-violet-950' : 'bg-violet-900') : (isDarkMode ? 'bg-rose-950' : 'bg-rose-900')}`}>
                                <div className="flex items-center gap-2.5">
                                  <Layers size={18} className="opacity-80" />
                                  <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                    {scheduleMode === 'padrao' && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">PADRÃO</span>}
                                    {scheduleMode === 'previa' && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">PRÉVIA</span>}
                                    Horário dos Cursos: {course}
                                  </h2>
                                  {appMode !== 'aluno' && scheduleMode !== 'padrao' && <span className="text-[9px] font-black bg-white/10 px-3 py-1 rounded-full tracking-widest uppercase shadow-inner ml-2">{selectedWeek}</span>}
                                </div>
                                <button onClick={handlePrint} className="hidden md:flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 no-print">
                                  <Printer size={14} /> Imprimir Horário do Curso
                                </button>
                              </div>

                              <div className="hidden md:block overflow-x-auto">
                                <table className="w-full min-w-[800px] border-collapse relative text-xs">
                                  <thead>
                                    <tr className={`border-b text-[9px] font-black uppercase tracking-widest text-slate-400 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                      <th className={`sticky left-0 z-30 py-3 px-2 border-r-[3px] w-10 min-w-[40px] text-center shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>Dia</th>
                                      <th className={`sticky left-[40px] z-20 py-3 px-3 border-r-[3px] w-28 min-w-[112px] text-center shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>Horário</th>
                                      {courseClasses.map(cls => (
                                        <th key={cls} className={`py-3 px-4 border-r-[3px] last:border-r-0 text-center ${isDarkMode ? 'border-slate-700 text-slate-200' : 'border-slate-300 text-slate-800'}`}>{cls}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                                    {safeDays.map((day, dayIndex) => {
                                      const dayRecords = courseRecords.filter(r => r.day === day);
                                      const dayShifts = new Set(dayRecords.map(r => safeTimes.find(t => t.timeStr === r.time)?.shift).filter(Boolean));
                                      const hasDiurnoDay = dayShifts.has('Matutino') || dayShifts.has('Vespertino');
                                      const hasNoturnoDay = dayShifts.has('Noturno');
                                      const displayShiftsDay = new Set();
                                      
                                      if (hasDiurnoDay) {
                                        displayShiftsDay.add('Matutino');
                                        displayShiftsDay.add('Vespertino');
                                      }
                                      if (hasNoturnoDay) {
                                        displayShiftsDay.add('Noturno');
                                      }
                                      
                                      const activeTimes = safeTimes.filter(t => displayShiftsDay.has(t.shift));
                                      const hasClassesToday = dayRecords.length > 0;

                                      if (!hasClassesToday || activeTimes.length === 0) {
                                        return (
                                          <React.Fragment key={`day-block-${day}-empty`}>
                                            <tr className="group transition-colors">
                                              <td className={`sticky left-0 z-20 border-r-[3px] align-middle text-center ${isDarkMode ? 'bg-slate-900 border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.2)]' : 'bg-slate-50 border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.02)]'}`}>
                                                <div className="flex items-center justify-center h-full w-full min-h-[80px] p-2">
                                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500" style={{ transform: 'rotate(-90deg)', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                                    {day.split('-')[0]}
                                                  </span>
                                                </div>
                                              </td>
                                              <td colSpan={courseClasses.length + 1} className={`py-4 text-center font-bold text-xs uppercase tracking-widest ${isDarkMode ? 'text-slate-500 bg-slate-800/20' : 'text-slate-400 bg-slate-50/50'}`}>
                                                Sem Aulas
                                              </td>
                                            </tr>
                                            {dayIndex < safeDays.length - 1 && (
                                              <tr className={`border-y-[4px] ${isDarkMode ? 'bg-slate-700/40 border-slate-700' : 'bg-slate-300/40 border-slate-300'}`}>
                                                <td colSpan={courseClasses.length + 2} className="py-1 shadow-inner"></td>
                                              </tr>
                                            )}
                                          </React.Fragment>
                                        );
                                      }

                                      let currentShift = '';
                                      let classPositionInShift = 0;
                                      const activeIntervals = (intervals || []).filter(inv => displayShiftsDay.has(inv.shift));
                                      const shiftCount = new Set(activeTimes.map(i => i.shift)).size;
                                      const spanSize = activeTimes.length + shiftCount + activeIntervals.length;

                                      return (
                                        <React.Fragment key={`day-block-${day}`}>
                                          {activeTimes.map((timeObj, index) => {
                                            const time = timeObj.timeStr;
                                            const shift = timeObj.shift;
                                            const isNewShift = shift !== currentShift;
                                            if (isNewShift) {
                                               currentShift = shift;
                                               classPositionInShift = 1;
                                            } else {
                                               classPositionInShift++;
                                            }
                                            const isFirstRowOfDay = index === 0;

                                            const intervalMatched = activeIntervals.find(inv => inv.shift === shift && Number(inv.position) === classPositionInShift);

                                            return (
                                              <React.Fragment key={`${day}-${time}`}>
                                                {isNewShift && (
                                                  <tr className={`print-interval text-[7px] font-black uppercase tracking-[0.4em] border-y-[2px] ${isDarkMode ? 'bg-slate-800/80 text-slate-400 border-slate-700' : 'bg-slate-200/50 text-slate-500 border-slate-300'}`}>
                                                    {isFirstRowOfDay && (
                                                      <td 
                                                        rowSpan={spanSize} 
                                                        className={`sticky left-0 z-20 border-r-[3px] align-middle text-center bg-white ${isDarkMode ? '!bg-slate-900 border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.2)]' : '!bg-slate-50 border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.02)]'}`}
                                                      >
                                                        <div className="flex items-center justify-center h-full w-full min-h-[80px]">
                                                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500" style={{ transform: 'rotate(-90deg)', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                                            {day.split('-')[0]}
                                                          </span>
                                                        </div>
                                                      </td>
                                                    )}
                                                    <td colSpan={courseClasses.length + 1} className="py-1 text-center shadow-inner">{shift}</td>
                                                  </tr>
                                                )}
                                                <tr className="group transition-colors">
                                                  {!isNewShift && isFirstRowOfDay && (
                                                    <td 
                                                      rowSpan={spanSize} 
                                                      className={`sticky left-0 z-20 border-r-[3px] align-middle text-center bg-white ${isDarkMode ? '!bg-slate-900 border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.2)]' : '!bg-slate-50 border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.02)]'}`}
                                                    >
                                                      <div className="flex items-center justify-center h-full w-full min-h-[80px]">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500" style={{ transform: 'rotate(-90deg)', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                                          {day.split('-')[0]}
                                                        </span>
                                                      </div>
                                                    </td>
                                                  )}
                                                  <td className={`sticky left-[40px] z-10 py-3 px-3 border-r-[3px] font-bold text-xs whitespace-nowrap text-center ${isDarkMode ? 'bg-slate-800 group-hover:bg-slate-700/50 border-slate-700 text-slate-400 shadow-[2px_0_5px_rgba(0,0,0,0.2)]' : 'bg-white group-hover:bg-slate-50 border-slate-300 text-slate-500 shadow-[2px_0_5px_rgba(0,0,0,0.02)]'}`}>
                                                    {time}
                                                  </td>
                                                  {courseClasses.map(cls => {
                                                    const records = courseRecords.filter(r => r.className === cls && r.day === day && r.time === time);
                                                    return (
                                                    <td 
                                                      key={`${cls}-${time}`} 
                                                      onClick={() => {
                                                         if (['admin','gestao'].includes(userRole)) {
                                                            setEditorModal({ cls, day, time, tObj: timeObj });
                                                         }
                                                      }}
                                                      className={`p-1.5 border-r-[3px] last:border-r-0 align-top min-w-[140px] transition-all
                                                      ${['admin','gestao'].includes(userRole) ? 'cursor-pointer hover:ring-2 hover:ring-indigo-500 hover:z-30 relative' : ''}
                                                      ${isDarkMode ? 'border-slate-700 group-hover:bg-slate-700/30 bg-slate-800/20' : 'border-slate-300 group-hover:bg-slate-50/50 bg-slate-50/20'}`}
                                                    >
                                                        {records.length > 0 ? records.map(r => {
                                                          const isPending = isTeacherPending(r.teacher);
                                                          return (
                                                            <div key={r.id} className={`print-clean-card p-2 rounded-xl border shadow-sm flex flex-col justify-center min-h-[50px] transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 ${isPending ? (isDarkMode ? 'bg-red-900/30 border-red-800/50 text-red-300' : 'bg-red-50 border-red-300 text-red-800') : getColorHash(r.subject, isDarkMode)}`}>
                                                              <p className={`subject font-medium text-[10px] leading-tight text-center ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                                                {r.subject} <span className={`font-medium opacity-80 ${isPending ? (isDarkMode ? 'text-red-400 font-bold' : 'text-red-600 font-bold') : ''}`}>- {resolveTeacherName(r.teacher, globalTeachers)}</span>
                                                              </p>
                                                            </div>
                                                          );
                                                        }) : <div className={`h-[50px] flex items-center justify-center font-black text-[9px] tracking-widest uppercase select-none ${isDarkMode ? 'opacity-20' : 'opacity-5'}`}>-</div>}
                                                      </td>
                                                    );
                                                  })}
                                                </tr>
                                                {intervalMatched && (
                                                  <tr className={`print-interval text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-amber-900/40 text-amber-500 border-amber-900/50' : 'bg-amber-50 text-amber-700 border-amber-200'} border-y`}>
                                                    <td className={`sticky left-[40px] z-10 py-2 px-3 text-center border-r-[3px] bg-transparent ${isDarkMode ? 'border-amber-900/50' : 'border-amber-200'}`}>
                                                       <span className="opacity-80 font-bold block whitespace-nowrap">
                                                          {(() => {
                                                              let endStr = timeObj.timeStr.split('-')[1];
                                                              if(!endStr) return '';
                                                              endStr = endStr.trim();
                                                              let [hh, mm] = endStr.split(':').map(Number);
                                                              if(isNaN(hh) || isNaN(mm)) return '';
                                                              let startText = endStr;
                                                              let endMins = hh * 60 + mm + Number(intervalMatched.duration);
                                                              let outHH = Math.floor(endMins / 60).toString().padStart(2, '0');
                                                              let outMM = (endMins % 60).toString().padStart(2, '0');
                                                              return `${startText} - ${outHH}:${outMM}`;
                                                          })()}
                                                       </span>
                                                    </td>
                                                    <td colSpan={courseClasses.length} className="py-2 px-4 shadow-sm relative text-center">
                                                      <div className="flex items-center justify-center gap-2">
                                                        <Clock size={12}/> {intervalMatched.description || 'Intervalo'} ({intervalMatched.duration} min)
                                                      </div>
                                                    </td>
                                                  </tr>
                                                )}
                                              </React.Fragment>
                                            );
                                          })}
                                          {/* Separador entre os dias na matriz */}
                                          {dayIndex < safeDays.length - 1 && (
                                            <tr className={`border-y-[4px] ${isDarkMode ? 'bg-slate-700/40 border-slate-700' : 'bg-slate-300/40 border-slate-300'}`}>
                                              <td colSpan={activeCourseClasses.length + 2} className="py-1 shadow-inner"></td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              
                              {/* Mobile Stacked View (Curso) */}
                              <div className="md:hidden p-4 space-y-4">
                                 {(() => {
                                   const activeMobileCls = mobileSelectedClasses[course] || courseClasses[0];
                                   const clsRecordsAll = courseRecords.filter(r => r.className === activeMobileCls);
                                   
                                   return (
                                     <div className="animate-in fade-in zoom-in-95">
                                       <div className="mb-4">
                                          <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 pl-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Visualizar Turma</label>
                                          <div className={`flex items-center gap-3 border rounded-xl px-4 py-3 shadow-sm relative ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                            <Layers className={isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} size={18} />
                                            <select 
                                              value={activeMobileCls}
                                              onChange={(e) => setMobileSelectedClasses(prev => ({...prev, [course]: e.target.value}))}
                                              className={`flex-1 bg-transparent font-bold text-sm outline-none appearance-none cursor-pointer ${isDarkMode ? 'text-white' : 'text-slate-800'}`}
                                            >
                                              {courseClasses.map(cls => (
                                                <option key={`${course}-mob-opt-${cls}`} value={cls} className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}>{cls}</option>
                                              ))}
                                            </select>
                                            <ChevronDown size={16} className={`pointer-events-none opacity-50 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                                          </div>
                                       </div>
                                       
                                       {clsRecordsAll.length === 0 ? (
                                         <div className={`p-8 rounded-xl border text-center font-bold text-xs uppercase tracking-widest shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                           Nenhuma Atividade
                                         </div>
                                       ) : (
                                         <div className="space-y-4">
                                           {safeDays.map(day => {
                                              const dayRecords = clsRecordsAll.filter(r => r.day === day);
                                              if (dayRecords.length === 0) return null;
                                              
                                              const dayShifts = new Set(dayRecords.map(r => safeTimes.find(t => t.timeStr === r.time)?.shift).filter(Boolean));
                                              const hasDiurno = dayShifts.has('Matutino') || dayShifts.has('Vespertino');
                                              const hasNoturno = dayShifts.has('Noturno');
                                              const displayShifts = new Set();
                                              if (hasDiurno) { displayShifts.add('Matutino'); displayShifts.add('Vespertino'); }
                                              if (hasNoturno) displayShifts.add('Noturno');
                                              const activeTimes = safeTimes.filter(t => displayShifts.has(t.shift));
                                              
                                              return (
                                                <div key={`mob-${course}-${activeMobileCls}-${day}`} className={`rounded-xl border overflow-hidden shadow-sm ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-white'}`}>
                                                  <div className={`px-4 py-2.5 font-black text-[10px] uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                                    {getFormattedDayLabel(day)}
                                                  </div>
                                                  <div className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                                                    {activeTimes.map((timeObj, idx) => {
                                                      const time = timeObj.timeStr || timeObj;
                                                      const records = dayRecords.filter(r => r.time === time);
                                                      const isLunch = time === '11:10 - 12:00';
                                                      
                                                      const timeRow = (
                                                        <div key={`${course}-${activeMobileCls}-${day}-${time}-row`} className={`flex items-start gap-3 p-3 transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                                                          <div className="w-16 shrink-0 text-center">
                                                             <span className={`block border font-black text-[9px] px-1 py-1 rounded-md shadow-sm opacity-80 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}>{time}</span>
                                                          </div>
                                                          <div className="flex-1 space-y-2">
                                                            {records.length > 0 ? records.map(r => {
                                                              const isPending = isTeacherPending(r.teacher);
                                                              return (
                                                                <div key={`mob-rec-${r.id}`} className={`p-2.5 flex items-center justify-between gap-2 rounded-lg border shadow-sm ${isPending ? (isDarkMode ? 'bg-red-900/30 border-red-800/50 text-red-300' : 'bg-red-50 border-red-200 text-red-800') : getColorHash(r.subject, isDarkMode)}`}>
                                                                  <div className="flex items-center gap-1.5 flex-1 max-w-[calc(100%-60px)]">
                                                                    <span className="font-bold text-[10px] leading-tight break-words pr-1">{r.subject}</span>
                                                                  </div>
                                                                  <span className={`text-[8px] font-bold uppercase tracking-wide shrink-0 bg-white/10 px-1 rounded ${isPending ? (isDarkMode ? 'text-red-400' : 'text-red-600') : 'opacity-80'}`}>{isPending ? 'SEM PROF.' : resolveTeacherName(r.teacher, globalTeachers).split(' ')[0]}</span>
                                                                </div>
                                                              )
                                                            }) : (
                                                              <div className={`font-black tracking-widest text-[9px] opacity-20 uppercase mt-1`}>Sem Aulas</div>
                                                            )}
                                                          </div>
                                                        </div>
                                                      );
                                                      
                                                      return (
                                                        <React.Fragment key={`${course}-${activeMobileCls}-${day}-${time}-frag`}>
                                                          {timeRow}
                                                          {isLunch && (
                                                             <div className={`py-1.5 text-center text-[7px] font-black uppercase tracking-[0.4em] border-y-[2px] ${isDarkMode ? 'bg-slate-800/40 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                               Intervalo
                                                             </div>
                                                          )}
                                                        </React.Fragment>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              );
                                           })}
                                         </div>
                                       )}
                                     </div>
                                   );
                                 })()}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}

                  {/* GRADE DE HORÁRIO DO PROFESSOR (Separada por Curso) */}
                  {viewMode === 'professor' && selectedTeacher && (
                    <div className="space-y-6 animate-in zoom-in-95 duration-500">
                      {(() => {
                        const profRecords = recordsForWeek.filter(r => r.teacher === selectedTeacher);
                        const profCourses = [...new Set(profRecords.map(r => r.course))].sort((a,b) => a.localeCompare(b));

                        if (profCourses.length === 0) {
                          return (
                            <div className={`rounded-2xl border p-12 text-center shadow-sm no-print ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                              <UserCircle size={40} className={`mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                              <h3 className={`text-lg font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Sem Aulas</h3>
                              <p className={`text-sm font-medium mt-1 max-w-md mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                O professor não possui aulas na semana selecionada.
                              </p>
                            </div>
                          );
                        }

                        return profCourses.map(course => {
                          const courseRecords = profRecords.filter(r => r.course === course);
                          const courseClasses = [...new Set(courseRecords.map(r => r.className))].sort();
                          const courseDays = safeDays.filter(day => courseRecords.some(r => r.day === day));

                          return (
                            <div key={`prof-course-${course}`} className={`rounded-2xl shadow-sm border overflow-hidden mb-6 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                              <div className={`text-white px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print ${scheduleMode === 'padrao' ? (isDarkMode ? 'bg-blue-950' : 'bg-blue-900') : scheduleMode === 'previa' ? (isDarkMode ? 'bg-violet-950' : 'bg-violet-900') : (isDarkMode ? 'bg-indigo-950' : 'bg-indigo-900')}`}>
                                <div className="flex items-center gap-2.5">
                                  <UserCircle size={18} className="opacity-80" />
                                  <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                    {scheduleMode === 'padrao' && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">PADRÃO</span>}
                                    {scheduleMode === 'previa' && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">PRÉVIA</span>}
                                    Horário: {selectedTeacher} - {course}
                                  </h2>
                                  {appMode !== 'aluno' && scheduleMode !== 'padrao' && <span className="text-[9px] font-black bg-white/10 px-3 py-1 rounded-full tracking-widest uppercase shadow-inner ml-2">{selectedWeek}</span>}
                                </div>
                                <button onClick={handlePrint} className="hidden md:flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 no-print">
                                  <Printer size={14} /> Imprimir Horário
                                </button>
                              </div>

                              <div className="hidden md:block overflow-x-auto">
                                <table className="w-full min-w-[600px] border-collapse relative text-xs">
                                  <thead>
                                    <tr className={`border-b text-[9px] font-black uppercase tracking-widest text-slate-400 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                      <th className={`sticky left-0 z-30 py-3 px-2 border-r-[3px] w-10 min-w-[40px] text-center shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>Dia</th>
                                      <th className={`sticky left-[40px] z-20 py-3 px-3 border-r-[3px] w-28 min-w-[112px] text-center shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>Horário</th>
                                      {courseClasses.map(cls => (
                                        <th key={`head-${cls}`} className={`py-3 px-4 border-r-[3px] last:border-r-0 text-center ${isDarkMode ? 'border-slate-700 text-slate-200' : 'border-slate-300 text-slate-800'}`}>{cls}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                                    {courseDays.map((day, dayIndex) => {
                                      const activeTimes = safeTimes.filter(timeObj => courseRecords.some(r => r.day === day && r.time === (timeObj.timeStr || timeObj)));

                                      return (
                                        <React.Fragment key={`prof-day-block-${day}`}>
                                          {activeTimes.map((timeObj, index) => {
                                            const timeStr = timeObj.timeStr || timeObj;
                                            const isFirstRowOfDay = index === 0;
                                            const hasLunch = activeTimes.some(t => (t.timeStr || t) === '11:10 - 12:00');
                                            const isLunch = timeStr === '11:10 - 12:00';

                                            return (
                                              <React.Fragment key={`prof-${day}-${timeStr}`}>
                                                <tr className="group transition-colors">
                                                  {isFirstRowOfDay && (
                                                    <td
                                                      rowSpan={activeTimes.length + (hasLunch ? 1 : 0)}
                                                      className={`sticky left-0 z-20 border-r-[3px] align-middle text-center ${isDarkMode ? 'bg-slate-900 border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.2)]' : 'bg-slate-50 border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.02)]'}`}
                                                    >
                                                      <div className="flex items-center justify-center h-full w-full min-h-[80px]">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500" style={{ transform: 'rotate(-90deg)', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                                          {day.split('-')[0]}
                                                        </span>
                                                      </div>
                                                    </td>
                                                  )}
                                                  <td className={`sticky left-[40px] z-10 py-3 px-3 border-r-[3px] font-bold text-xs whitespace-nowrap text-center ${isDarkMode ? 'bg-slate-800 group-hover:bg-slate-700/50 border-slate-700 text-slate-400 shadow-[2px_0_5px_rgba(0,0,0,0.2)]' : 'bg-white group-hover:bg-slate-50 border-slate-300 text-slate-500 shadow-[2px_0_5px_rgba(0,0,0,0.02)]'}`}>
                                                    {timeStr}
                                                  </td>
                                                  {courseClasses.map(cls => {
                                                    const records = courseRecords.filter(r => r.className === cls && r.day === day && r.time === timeStr);
                                                    return (
                                                      <td key={`prof-${cls}-${timeStr}`} className={`p-1.5 border-r-[3px] last:border-r-0 align-top min-w-[140px] ${isDarkMode ? 'border-slate-700 group-hover:bg-slate-700/30 bg-slate-800/20' : 'border-slate-300 group-hover:bg-slate-50/50 bg-slate-50/20'}`}>
                                                        {records.length > 0 ? records.map(r => {
                                                          const isPending = isTeacherPending(r.teacher);
                                                          return (
                                                          <div key={`p-rec-${r.id}`} className={`print-clean-card p-2.5 rounded-xl border shadow-sm flex flex-col justify-center min-h-[60px] transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 ${isPending ? (isDarkMode ? 'bg-red-900/30 border-red-800/50 text-red-300' : 'bg-red-50 border-red-300 text-red-800') : getColorHash(r.subject, isDarkMode)}`}>
                                                            {isPending && <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded w-fit mx-auto mb-0.5 ${isDarkMode ? 'text-red-400 bg-red-900/50' : 'text-red-600 bg-red-100'}`}>SEM PROFESSOR</span>}
                                                            <p className="subject font-black text-[11px] leading-tight text-center">{r.subject}</p>
                                                            {r.room && <span className={`details text-[8px] font-black tracking-tighter opacity-70 px-1.5 py-0.5 rounded mt-1 w-fit uppercase mx-auto ${isDarkMode ? 'bg-white/10' : 'bg-black/5'}`}>{r.room}</span>}
                                                          </div>
                                                        )}) : <div className={`h-[60px] flex items-center justify-center font-black text-[9px] tracking-widest uppercase select-none ${isDarkMode ? 'opacity-20' : 'opacity-5'}`}>-</div>}
                                                      </td>
                                                    );
                                                  })}
                                                </tr>
                                                {isLunch && (
                                                  <tr className={`print-interval text-[8px] font-black uppercase tracking-[0.4em] border-y-[3px] ${isDarkMode ? 'bg-slate-800/60 text-slate-500 border-slate-700' : 'bg-slate-100/60 text-slate-400 border-slate-300'}`}>
                                                    <td colSpan={courseClasses.length + 2} className="py-2 text-center shadow-inner">Intervalo / Almoço</td>
                                                  </tr>
                                                )}
                                              </React.Fragment>
                                            );
                                          })}
                                          {/* Separador entre os dias na matriz */}
                                          {dayIndex < courseDays.length - 1 && (
                                            <tr className={`border-y-[4px] ${isDarkMode ? 'bg-slate-700/40 border-slate-700' : 'bg-slate-300/40 border-slate-300'}`}>
                                              <td colSpan={courseClasses.length + 2} className="py-1 shadow-inner"></td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              {/* Mobile Stacked View (Professor Full Week) */}
                              <div className="md:hidden p-4 space-y-4">
                                {courseDays.map(day => {
                                  const dayRecords = courseRecords.filter(r => r.day === day);
                                  if (dayRecords.length === 0) return null;
                                  
                                  const activeTimes = safeTimes.filter(t => dayRecords.some(r => r.time === (t.timeStr || t)));
                                  
                                  return (
                                    <div key={`mob-prof-${course}-${day}`} className={`rounded-xl border overflow-hidden shadow-sm animate-in fade-in ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-white'}`}>
                                      <div className={`px-4 py-2.5 font-black text-[10px] uppercase tracking-widest ${isDarkMode ? 'bg-indigo-950/50 text-indigo-400' : 'bg-indigo-50 text-indigo-700'}`}>
                                        {getFormattedDayLabel(day)}
                                      </div>
                                      <div className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                                        {activeTimes.map((timeObj, idx) => {
                                          const time = timeObj.timeStr || timeObj;
                                          const records = dayRecords.filter(r => r.time === time);
                                          const isLunch = time === '11:10 - 12:00';
                                          
                                          const timeRow = (
                                            <div key={`mob-prof-${course}-${day}-${time}-row`} className={`flex items-start gap-3 p-3 transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                                              <div className="w-16 shrink-0 text-center">
                                                 <span className={`block border font-black text-[9px] px-1 py-1 rounded-md shadow-sm opacity-80 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}>{time}</span>
                                              </div>
                                              <div className="flex-1 space-y-2">
                                                {records.map(r => {
                                                  const isPending = isTeacherPending(r.teacher);
                                                  return (
                                                    <div key={`mob-rec-${r.id}`} className={`p-2.5 rounded-lg border shadow-sm flex flex-col justify-center ${isPending ? (isDarkMode ? 'bg-red-900/30 border-red-800/50 text-red-300' : 'bg-red-50 border-red-200 text-red-900') : getColorHash(r.subject, isDarkMode)}`}>
                                                      <div className="flex items-center gap-1.5 flex-1 w-full">
                                                        <span className={`text-[8px] font-black uppercase rounded px-1 shrink-0 ${isDarkMode ? 'bg-white/20' : 'bg-black/10'}`}>{r.className}</span>
                                                        <span className="font-bold text-[10px] leading-tight truncate">{r.subject}</span>
                                                      </div>
                                                      {r.room && <span className={`text-[8px] font-black uppercase tracking-widest pl-1 mt-1 opacity-80 block`}>SALA: {r.room}</span>}
                                                    </div>
                                                  )
                                                })}
                                              </div>
                                            </div>
                                          );
                                          
                                          return (
                                            <React.Fragment key={`mob-prof-${course}-${day}-${time}-frag`}>
                                              {timeRow}
                                              {isLunch && (
                                                <div className={`py-1.5 text-center text-[7px] font-black uppercase tracking-[0.4em] border-y-[2px] ${isDarkMode ? 'bg-slate-800/40 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                  Intervalo
                                                </div>
                                              )}
                                            </React.Fragment>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}

                  {/* GRADE DE HORÁRIO GERAL (Turma COMPLETA) */}
                  {viewMode === 'turma' && (
                    <div className={`rounded-2xl shadow-sm border overflow-hidden animate-in zoom-in-95 duration-500 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <div className={`text-white px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print ${scheduleMode === 'padrao' ? (isDarkMode ? 'bg-blue-950' : 'bg-blue-900') : scheduleMode === 'previa' ? (isDarkMode ? 'bg-violet-950' : 'bg-violet-900') : (isDarkMode ? 'bg-emerald-950' : 'bg-emerald-800')}`}>
                        <div className="flex items-center gap-2.5">
                          <Users size={18} className="opacity-80" />
                          <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                            {scheduleMode === 'padrao' && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">PADRÃO</span>}
                            {scheduleMode === 'previa' && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">PRÉVIA</span>}
                            Grade: {selectedClass}
                          </h2>
                          {appMode !== 'aluno' && scheduleMode !== 'padrao' && <span className="text-[9px] font-black bg-white/10 px-3 py-1 rounded-full tracking-widest uppercase shadow-inner ml-2">{selectedWeek}</span>}
                        </div>
                        
                        <button onClick={handlePrint} className="hidden md:flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 no-print">
                          <Printer size={14} /> Imprimir Grade
                        </button>
                      </div>
                      
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full min-w-[750px] border-collapse relative text-xs">
                          <thead>
                            <tr className={`border-b text-[9px] font-black uppercase tracking-widest text-slate-400 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                              <th className={`sticky left-0 z-20 py-3 px-4 border-r-[3px] w-28 text-center ${isDarkMode ? 'bg-slate-900 border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.2)]' : 'bg-slate-100 border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.02)]'}`}>Horário</th>
                              {safeDays.map(day => (<th key={day} className={`py-3 px-4 border-r-[3px] last:border-r-0 text-center ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}>{day.split('-')[0]}</th>))}
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                            {(() => {
                              const turmaRecords = recordsForWeek.filter(r => r.className === selectedClass);
                              const entityShifts = new Set(turmaRecords.map(r => safeTimes.find(t => t.timeStr === r.time)?.shift).filter(Boolean));
                              const hasDiurno = entityShifts.has('Matutino') || entityShifts.has('Vespertino');
                              const hasNoturno = entityShifts.has('Noturno');
                              const displayShifts = new Set();
                              
                              if (hasDiurno) {
                                displayShifts.add('Matutino');
                                displayShifts.add('Vespertino');
                              }
                              if (hasNoturno) {
                                displayShifts.add('Noturno');
                              }
                              
                              const entityTimes = safeTimes.filter(t => displayShifts.has(t.shift));

                              let currentShift = '';
                              return entityTimes.map((timeObj, index) => {
                                const time = timeObj.timeStr || timeObj;
                                const shift = timeObj.shift || '';
                                const isNewShift = shift && shift !== currentShift;
                                if (isNewShift) currentShift = shift;
                                const isLunch = time === '11:10 - 12:00';
                                
                                return (
                                  <React.Fragment key={time}>
                                  {isNewShift && (
                                    <tr className={`print-interval text-[8px] font-black uppercase tracking-[0.4em] border-y-[3px] ${isDarkMode ? 'bg-slate-800/60 text-slate-500 border-slate-700' : 'bg-slate-100/60 text-slate-400 border-slate-300'}`}>
                                      <td colSpan={safeDays.length + 1} className="py-2 text-center shadow-inner">{shift}</td>
                                    </tr>
                                  )}
                                  <tr className="group transition-colors">
                                    <td className={`sticky left-0 z-10 py-3 px-4 border-r-[3px] font-bold text-xs whitespace-nowrap text-center ${isDarkMode ? 'bg-slate-800 group-hover:bg-slate-700/50 border-slate-700 text-slate-400 shadow-[2px_0_5px_rgba(0,0,0,0.2)]' : 'bg-white group-hover:bg-slate-50 border-slate-300 text-slate-500 shadow-[2px_0_5px_rgba(0,0,0,0.02)]'}`}>{time}</td>
                                    {safeDays.map(day => {
                                      const records = getCellRecords(day, time);
                                      return (
                                        <td key={`${day}-${time}`} className={`p-1.5 border-r-[3px] last:border-r-0 align-top w-32 ${isDarkMode ? 'border-slate-700 group-hover:bg-slate-700/30 bg-slate-800/20' : 'border-slate-300 group-hover:bg-slate-50/50 bg-slate-50/20'}`}>
                                          {records.length > 0 ? (
                                            <div className="flex flex-col gap-1.5">
                                              {records.map(r => {
                                                const isPending = isTeacherPending(r.teacher);
                                                
                                                return (
                                                  <div key={r.id} className={`print-clean-card p-2 rounded-xl border shadow-sm flex flex-col justify-center min-h-[60px] transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 ${isPending ? (isDarkMode ? 'bg-red-900/30 border-red-800/50 text-red-300' : 'bg-red-50 border-red-300 text-red-800') : getColorHash(r.subject, isDarkMode)}`}>
                                                    {isPending && <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded w-fit mx-auto mb-0.5 ${isDarkMode ? 'text-red-400 bg-red-900/50' : 'text-red-600 bg-red-100'}`}>SEM PROFESSOR</span>}
                                                    <p className="subject font-bold text-[10px] leading-tight mb-0.5 text-center">{r.subject}</p>
                                                    <p className="details text-[8px] font-bold opacity-80 flex items-center justify-center gap-1 uppercase truncate">
                                                      {resolveTeacherName(r.teacher, globalTeachers)}
                                                    </p>
                                                    {r.room && <span className={`details text-[8px] font-black tracking-tighter opacity-60 px-1.5 py-0.5 rounded mt-1 w-fit uppercase mx-auto ${isDarkMode ? 'bg-white/10' : 'bg-black/5'}`}>{r.room}</span>}
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          ) : <div className={`h-[60px] flex items-center justify-center font-black text-[9px] tracking-widest uppercase select-none ${isDarkMode ? 'opacity-20' : 'opacity-5'}`}>-</div>}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                  {isLunch && (
                                    <tr className={`print-interval text-[8px] font-black uppercase tracking-[0.4em] border-y-[3px] ${isDarkMode ? 'bg-slate-800/60 text-slate-500 border-slate-700' : 'bg-slate-100/60 text-slate-400 border-slate-300'}`}>
                                      <td colSpan={safeDays.length + 1} className="py-2 text-center shadow-inner">Intervalo / Almoço</td>
                                    </tr>
                                  )}
                                  </React.Fragment>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Mobile Stacked View (Turma) */}
                      <div className="md:hidden p-4 space-y-4">
                        {(() => {
                          const turmaRecords = recordsForWeek.filter(r => r.className === selectedClass);
                          if (turmaRecords.length === 0) {
                            return <div className="text-center text-slate-400 font-bold uppercase tracking-widest text-[10px] p-8 border rounded-xl border-dashed">Sem aulas programadas</div>;
                          }
                          return safeDays.map(day => {
                            const dayRecords = turmaRecords.filter(r => r.day === day);
                            if (dayRecords.length === 0) return null;
                            
                            const dayShifts = new Set(dayRecords.map(r => safeTimes.find(t => t.timeStr === r.time)?.shift).filter(Boolean));
                            const hasDiurno = dayShifts.has('Matutino') || dayShifts.has('Vespertino');
                            const hasNoturno = dayShifts.has('Noturno');
                            const displayShifts = new Set();
                            if (hasDiurno) { displayShifts.add('Matutino'); displayShifts.add('Vespertino'); }
                            if (hasNoturno) displayShifts.add('Noturno');
                            const activeTimes = safeTimes.filter(t => displayShifts.has(t.shift));
                            
                            return (
                              <div key={`mob-${day}`} className={`rounded-xl border overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-white'}`}>
                                <div className={`px-4 py-2.5 font-black text-[10px] uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                  {getFormattedDayLabel(day)}
                                </div>
                                <div className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                                  {activeTimes.map((timeObj, idx) => {
                                    const time = timeObj.timeStr || timeObj;
                                    const records = dayRecords.filter(r => r.time === time);
                                    const isLunch = time === '11:10 - 12:00';
                                    
                                    const timeRow = (
                                      <div key={`${day}-${time}-row`} className={`flex items-center gap-3 p-3 transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                                        <div className="w-16 shrink-0 text-center">
                                           <span className={`block border font-black text-[9px] px-1 py-1 rounded-md shadow-sm opacity-80 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}>{time}</span>
                                        </div>
                                        <div className="flex-1 space-y-2">
                                          {records.length > 0 ? records.map(r => {
                                            const isPending = isTeacherPending(r.teacher);
                                            return (
                                              <div key={`mob-rec-${r.id}`} className={`p-2.5 rounded-lg border shadow-sm flex flex-col justify-center ${isPending ? (isDarkMode ? 'bg-red-900/30 border-red-800/50 text-red-300' : 'bg-red-50 border-red-200 text-red-800') : getColorHash(r.subject, isDarkMode)}`}>
                                                <p className="font-black text-[11px] leading-tight mb-1">{r.subject}</p>
                                                <p className={`text-[9px] font-bold uppercase tracking-wide truncate ${isPending ? (isDarkMode ? 'text-red-400' : 'text-red-600') : 'opacity-80'}`}>{isPending ? 'SEM PROFESSOR' : resolveTeacherName(r.teacher, globalTeachers)}</p>
                                                {r.room && <span className={`text-[8px] font-black uppercase tracking-widest mt-1.5 px-2 py-0.5 rounded w-fit ${isDarkMode ? 'bg-white/10' : 'bg-black/5'}`}>{r.room}</span>}
                                              </div>
                                            )
                                          }) : <div className={`font-black tracking-widest text-[9px] opacity-20 uppercase mx-auto w-fit`}>-</div>}
                                        </div>
                                      </div>
                                    );
                                    
                                    return (
                                      <React.Fragment key={`${day}-${time}-frag`}>
                                        {timeRow}
                                        {isLunch && (
                                           <div className={`py-1.5 text-center text-[7px] font-black uppercase tracking-[0.4em] border-y-[2px] ${isDarkMode ? 'bg-slate-800/40 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                             Intervalo
                                           </div>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}

                  {/* VISTA DE AULAS VAGAS: Separada por Curso */}
                  {viewMode === 'sem_professor' && (
                    <div className="space-y-6 animate-in zoom-in-95 duration-500">
                      {(() => {
                        const pendingRecordsForWeek = recordsForWeek.filter(r => isTeacherPending(r.teacher));
                        const pendingCourses = [...new Set(pendingRecordsForWeek.map(r => r.course))].sort((a,b) => a.localeCompare(b));

                        if (pendingCourses.length === 0) {
                          return (
                            <div className={`rounded-2xl border p-12 text-center shadow-sm no-print ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                              <CheckCircle size={40} className="mx-auto text-emerald-400 mb-3" />
                              <h3 className={`text-lg font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Nenhuma Aula Vaga</h3>
                              <p className={`text-sm font-medium mt-1 max-w-md mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                Todas as aulas da semana selecionada já possuem professor atribuído.
                              </p>
                            </div>
                          );
                        }

                        return pendingCourses.map(course => {
                          const courseRecords = pendingRecordsForWeek.filter(r => r.course === course);
                          const courseClasses = [...new Set(courseRecords.map(r => r.className))].sort();
                          const courseDays = safeDays.filter(day => courseRecords.some(r => r.day === day));

                          return (
                            <div key={course} className={`rounded-2xl shadow-sm border overflow-hidden mb-6 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                              <div className={`text-white px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print ${isDarkMode ? 'bg-red-950' : 'bg-red-900'}`}>
                                <div className="flex items-center gap-2.5">
                                  <AlertTriangle size={18} className="opacity-80" />
                                  <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                    {scheduleMode === 'padrao' && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">PADRÃO</span>}
                                    {scheduleMode === 'previa' && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">PRÉVIA</span>}
                                    Aulas Vagas: {course}
                                  </h2>
                                  {appMode !== 'aluno' && scheduleMode !== 'padrao' && <span className="text-[9px] font-black bg-white/10 px-3 py-1 rounded-full tracking-widest uppercase shadow-inner ml-2">{selectedWeek}</span>}
                                </div>
                                <button onClick={handlePrint} className="hidden md:flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 no-print">
                                  <Printer size={14} /> Imprimir Aulas Vagas
                                </button>
                              </div>

                              <div className="hidden md:block overflow-x-auto">
                                <table className="w-full min-w-[600px] border-collapse relative text-xs">
                                  <thead>
                                    <tr className={`border-b text-[9px] font-black uppercase tracking-widest text-slate-400 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                      <th className={`sticky left-0 z-30 py-3 px-2 border-r-[3px] w-10 min-w-[40px] text-center shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>Dia</th>
                                      <th className={`sticky left-[40px] z-20 py-3 px-3 border-r-[3px] w-28 min-w-[112px] text-center shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>Horário</th>
                                      {courseClasses.map(cls => (
                                        <th key={cls} className={`py-3 px-4 border-r-[3px] last:border-r-0 text-center ${isDarkMode ? 'border-slate-700 text-slate-200' : 'border-slate-300 text-slate-800'}`}>{cls}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                                    {courseDays.map((day, dayIndex) => {
                                      const activeTimes = safeTimes.filter(timeObj => courseRecords.some(r => r.day === day && r.time === (timeObj.timeStr || timeObj)));

                                      return (
                                        <React.Fragment key={`day-block-${day}`}>
                                          {activeTimes.map((timeObj, index) => {
                                            const timeStr = timeObj.timeStr || timeObj;
                                            const isFirstRowOfDay = index === 0;
                                            const hasLunch = activeTimes.some(t => (t.timeStr || t) === '11:10 - 12:00');
                                            const isLunch = timeStr === '11:10 - 12:00';

                                            return (
                                              <React.Fragment key={`${day}-${timeStr}`}>
                                                <tr className="group transition-colors">
                                                  {isFirstRowOfDay && (
                                                    <td
                                                      rowSpan={activeTimes.length + (hasLunch ? 1 : 0)}
                                                      className={`sticky left-0 z-20 border-r-[3px] align-middle text-center ${isDarkMode ? 'bg-slate-900 border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.2)]' : 'bg-slate-50 border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.02)]'}`}
                                                    >
                                                      <div className="flex items-center justify-center h-full w-full min-h-[80px]">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500" style={{ transform: 'rotate(-90deg)', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                                          {day.split('-')[0]}
                                                        </span>
                                                      </div>
                                                    </td>
                                                  )}
                                                  <td className={`sticky left-[40px] z-10 py-3 px-3 border-r-[3px] font-bold text-xs whitespace-nowrap text-center ${isDarkMode ? 'bg-slate-800 group-hover:bg-slate-700/50 border-slate-700 text-slate-400 shadow-[2px_0_5px_rgba(0,0,0,0.2)]' : 'bg-white group-hover:bg-slate-50 border-slate-300 text-slate-500 shadow-[2px_0_5px_rgba(0,0,0,0.02)]'}`}>
                                                    {timeStr}
                                                  </td>
                                                  {courseClasses.map(cls => {
                                                    const records = courseRecords.filter(r => r.className === cls && r.day === day && r.time === timeStr);
                                                    return (
                                                      <td key={`${cls}-${timeStr}`} className={`p-1.5 border-r-[3px] last:border-r-0 align-top min-w-[140px] ${isDarkMode ? 'border-slate-700 group-hover:bg-slate-700/30 bg-slate-800/20' : 'border-slate-300 group-hover:bg-slate-50/50 bg-slate-50/20'}`}>
                                                        {records.length > 0 ? records.map(r => (
                                                          <div key={r.id} className={`print-clean-card p-2.5 rounded-xl border shadow-sm flex flex-col justify-center min-h-[60px] transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 relative pt-4 ${isDarkMode ? 'bg-red-900/30 border-red-800/50' : 'bg-red-50 border-red-300'}`}>
                                                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-max">
                                                              <span className={`text-[8px] font-black uppercase tracking-widest text-white px-2 py-0.5 rounded shadow-sm ${isDarkMode ? 'bg-red-600 shadow-red-900/50' : 'bg-red-600 shadow-red-200'}`}>Sem Professor</span>
                                                            </div>
                                                            <p className={`subject font-black text-[11px] leading-tight text-center ${isDarkMode ? 'text-red-300' : 'text-red-900'}`}>
                                                              {r.subject}
                                                            </p>
                                                            {r.room && <span className={`details text-[8px] font-black tracking-tighter opacity-70 px-1.5 py-0.5 rounded mt-1 w-fit uppercase mx-auto ${isDarkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-200/50 text-red-900'}`}>{r.room}</span>}
                                                          </div>
                                                        )) : <div className={`h-[60px] flex items-center justify-center font-black text-[9px] tracking-widest uppercase select-none ${isDarkMode ? 'opacity-20' : 'opacity-5'}`}>-</div>}
                                                      </td>
                                                    );
                                                  })}
                                                </tr>
                                                {isLunch && (
                                                  <tr className={`print-interval text-[8px] font-black uppercase tracking-[0.4em] border-y-[3px] ${isDarkMode ? 'bg-slate-800/60 text-slate-500 border-slate-700' : 'bg-slate-100/60 text-slate-400 border-slate-300'}`}>
                                                    <td colSpan={courseClasses.length + 1} className="py-2 text-center shadow-inner">Intervalo / Almoço</td>
                                                  </tr>
                                                )}
                                              </React.Fragment>
                                            );
                                          })}
                                          {/* Separador entre os dias na matriz */}
                                          {dayIndex < courseDays.length - 1 && (
                                            <tr className={`border-y-[4px] ${isDarkMode ? 'bg-slate-700/40 border-slate-700' : 'bg-slate-300/40 border-slate-300'}`}>
                                              <td colSpan={courseClasses.length + 2} className="py-1 shadow-inner"></td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              {/* Mobile Stacked View (Aulas Vagas) */}
                              <div className="md:hidden p-4 space-y-4">
                                {courseDays.map(day => {
                                  const dayRecords = courseRecords.filter(r => r.day === day);
                                  if (dayRecords.length === 0) return null;
                                  
                                  const activeTimes = safeTimes.filter(t => dayRecords.some(r => r.time === (t.timeStr || t)));
                                  
                                  return (
                                    <div key={`mob-vagas-${course}-${day}`} className={`rounded-xl border overflow-hidden shadow-sm animate-in fade-in ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-white'}`}>
                                      <div className={`px-4 py-2.5 font-black text-[10px] uppercase tracking-widest ${isDarkMode ? 'bg-red-950/50 text-red-400' : 'bg-red-50 text-red-700'}`}>
                                        {getFormattedDayLabel(day)}
                                      </div>
                                      <div className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                                        {activeTimes.map((timeObj, idx) => {
                                          const time = timeObj.timeStr;
                                          const records = dayRecords.filter(r => r.time === time);
                                          const isLunch = time === '11:10 - 12:00';
                                          
                                          const timeRow = (
                                            <div key={`${course}-${day}-${time}-row`} className={`flex items-start gap-3 p-3 transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                                              <div className="w-16 shrink-0 text-center">
                                                 <span className={`block border font-black text-[9px] px-1 py-1 rounded-md shadow-sm opacity-80 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}>{time}</span>
                                              </div>
                                              <div className="flex-1 space-y-2">
                                                {records.map(r => (
                                                  <div key={`mob-rec-${r.id}`} className={`p-2.5 rounded-lg border shadow-sm flex flex-col justify-center ${isDarkMode ? 'bg-red-900/30 border-red-800/50 text-red-300' : 'bg-red-50 border-red-200 text-red-900'}`}>
                                                    <div className="flex items-center gap-1.5 flex-1 w-full">
                                                      <span className={`text-[8px] font-black uppercase rounded px-1 shrink-0 ${isDarkMode ? 'bg-red-950 text-red-400' : 'bg-red-200 text-red-800'}`}>{r.className}</span>
                                                      <span className="font-bold text-[10px] leading-tight truncate">{r.subject}</span>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          );
                                          
                                          return (
                                            <React.Fragment key={`${course}-${day}-${time}-frag`}>
                                              {timeRow}
                                              {isLunch && (
                                                <div className={`py-1.5 text-center text-[7px] font-black uppercase tracking-[0.4em] border-y-[2px] ${isDarkMode ? 'bg-slate-800/40 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                  Intervalo
                                                </div>
                                              )}
                                            </React.Fragment>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        
      {/* Editor Interativo */}
      {editorModal && (
         <ScheduleEditorModal 
            isOpen={true}
            onClose={(shouldRefresh) => {
               setEditorModal(null);
               if (shouldRefresh === true && typeof loadAdminMetadata === 'function') {
                  loadAdminMetadata(true);
               }
            }}
            isDarkMode={isDarkMode}
            scheduleMode={scheduleMode}
            selectedWeek={selectedWeek}
            className={editorModal.cls}
            day={editorModal.day}
            time={editorModal.time}
            timeObj={editorModal.tObj}
            courseRecords={getCellRecords ? getCellRecords(editorModal.cls, editorModal.day, editorModal.time) : []} 
            weekData={rawData} 
            matrixData={[]} // TODO
            classesData={[]} // TODO
            usersList={[]} // TODO
            classTimes={classTimes}
         />
      )}
    </>
  );
}
