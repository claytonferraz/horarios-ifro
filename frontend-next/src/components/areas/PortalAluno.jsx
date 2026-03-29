import React, { useState, useTransition } from 'react';
import { 
  Calendar, Layers, BarChart3, ListTodo, CalendarDays, Sun, RefreshCcw, HandHeart, X, ExternalLink, Scissors, MapPin, Monitor, Mail, MessageCircle, Activity,
  BookOpen, FileText, Users, CheckCircle, AlertCircle, XCircle, Eye, Clock, Check, Printer, Home, Globe, Book, Shuffle, ClipboardList, Search, LayoutDashboard, MessageSquare
} from 'lucide-react';
import { SearchableSelect } from '../ui/SearchableSelect';
import { MAP_DAYS, getColorHash, resolveTeacherName } from '@/lib/dates';
import { useData } from '@/contexts/DataContext';
import { apiClient } from '@/lib/apiClient';
import { ClassGrid } from './grids/ClassGrid';

/**
 * PORTAL DO ALUNO - Versão Desacoplada (Read-Only)
 * Focado exclusivamente na experiência do estudante com visualização de horários,
 * resumo semanal e links institucionais.
 */
export function PortalAluno({
  isDarkMode, isDim, viewMode, setViewMode, scheduleMode, setScheduleMode,
  selectedCourse, setSelectedCourse, selectedClass, setSelectedClass,
  selectedDay, setSelectedDay, selectedWeek, setSelectedWeek,
  activeDays, classTimes
}) {
  const { globalTeachers, subjectHoursMeta, selectedConfigYear, disciplinesMeta, schedules, academicWeeks } = useData();
  const [isPending, startTransition] = useTransition();
  const [dashboardTab, setDashboardTab] = useState('atual');

  // Constantes de mapeamento de dias
  const dayFullLabels = React.useMemo(() => ({ 'seg': 'Segunda', 'ter': 'Terça', 'qua': 'Quarta', 'qui': 'Quinta', 'sex': 'Sexta', 'sab': 'Sábado', 'dom': 'Domingo' }), []);
  const dayOrder = React.useMemo(() => ({ 'seg': 1, 'ter': 2, 'qua': 3, 'qui': 4, 'sex': 5, 'sab': 6, 'dom': 7 }), []);
  const shortDayMap = React.useMemo(() => ({ 
    'Segunda-feira': 'seg', 'Terça-feira': 'ter', 'Quarta-feira': 'qua', 'Quinta-feira': 'qui', 'Sexta-feira': 'sex', 'Sábado': 'sab', 'Domingo': 'dom',
    'seg': 'seg', 'ter': 'ter', 'qua': 'qua', 'qui': 'qui', 'sex': 'sex', 'sab': 'sab', 'dom': 'dom' 
  }), []);

  const handleCourseChange = (newCourse) => {
    if (typeof setSelectedCourse === 'function') {
      startTransition(() => setSelectedCourse(newCourse));
    }
  };

  const handleClassChange = (newClass) => {
    if (typeof setSelectedClass === 'function') {
      startTransition(() => setSelectedClass(newClass));
    }
  };

  const handleWeekChange = (newWeek) => {
    if (typeof setSelectedWeek === 'function') {
      startTransition(() => setSelectedWeek(newWeek));
    }
  };

  // Filtragem básica de horários baseada no modo (Atual, Prévia, etc)
  const horariosFiltrados = React.useMemo(() => {
    if (!schedules || !Array.isArray(schedules)) return [];
    
    const dbType = (scheduleMode === 'consolidado' || scheduleMode === 'atual') ? 'oficial' : scheduleMode;

    const filtered = schedules.filter(schedule => {
      if (String(schedule.academic_year) !== String(selectedConfigYear)) return false;
      
      const isProductionType = (schedule.type === 'oficial' || schedule.type === 'atual');
      if (scheduleMode === 'atual' || scheduleMode === 'consolidado') {
        if (!isProductionType) return false;
      } else {
        if (schedule.type !== dbType) return false;
      }
      
      if (scheduleMode !== 'padrao' && String(schedule.week_id) !== String(selectedWeek)) return false;
      return true;
    });

    // De-duplicação: Preferimos 'atual' sobre 'oficial' se coexistirem
    if (scheduleMode === 'atual' || scheduleMode === 'consolidado') {
        const dedupMap = new Map();
        filtered.forEach(s => {
           const key = `${s.week_id || s.weekId}-${s.dayOfWeek || s.day}-${s.slotId || s.time}-${s.classId || s.className}-${s.subjectName || s.subject}`;
           if (!dedupMap.has(key) || s.type === 'atual') {
               dedupMap.set(key, s);
           }
        });
        return Array.from(dedupMap.values());
    }

    return filtered;
  }, [schedules, selectedConfigYear, scheduleMode, selectedWeek]);

  // Persistência local de preferências do aluno
  React.useEffect(() => {
    const savedCourse = localStorage.getItem('ifro_aluno_course');
    const savedClass = localStorage.getItem('ifro_aluno_class');
    if (savedCourse && typeof setSelectedCourse === 'function') setSelectedCourse(savedCourse);
    if (savedClass && typeof setSelectedClass === 'function') {
      setTimeout(() => setSelectedClass(savedClass), 150);
    }
  }, [setSelectedCourse, setSelectedClass]);

  React.useEffect(() => {
    if (selectedCourse && selectedCourse !== 'Todos') localStorage.setItem('ifro_aluno_course', selectedCourse);
    if (selectedClass) localStorage.setItem('ifro_aluno_class', selectedClass);
  }, [selectedCourse, selectedClass]);

  const safeDays = React.useMemo(() => {
    return [...(activeDays || ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'])].sort((a,b) => MAP_DAYS.indexOf(a) - MAP_DAYS.indexOf(b));
  }, [activeDays]);
  
  const shiftOrder = { 'Matutino': 1, 'Vespertino': 2, 'Noturno': 3 };
  
  const safeTimes = React.useMemo(() => {
    return [...(classTimes || [])].sort((a, b) => {
      const shiftA = typeof a === 'object' ? a.shift : '';
      const shiftB = typeof b === 'object' ? b.shift : '';
      const orderA = shiftOrder[shiftA] || 99;
      const orderB = shiftOrder[shiftB] || 99;
      if (orderA !== orderB) return orderA - orderB;
      const timeA = typeof a === 'object' ? a.timeStr : a;
      const timeB = typeof b === 'object' ? b.timeStr : b;
      return timeA.localeCompare(timeB);
    });
  }, [classTimes]);

  const getFormattedDayLabel = (dayName) => {
    if (scheduleMode === 'padrao' || !selectedWeek || !academicWeeks) return dayName.split('-')[0].toUpperCase();
    const wObj = academicWeeks.find(w => String(w.id) === String(selectedWeek));
    if (!wObj || !wObj.start_date) return dayName.split('-')[0].toUpperCase();
    
    const parts = wObj.start_date.split('-');
    const baseDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
    const baseDayIndex = baseDate.getDay(); 
    const targetDayIndex = parseInt(Object.keys(MAP_DAYS).find(k => MAP_DAYS[k] === dayName));
    
    const diff = targetDayIndex - baseDayIndex; 
    const targetDate = new Date(baseDate);
    targetDate.setDate(targetDate.getDate() + diff);
    
    return `${dayName.split('-')[0].toUpperCase()} ${String(targetDate.getDate()).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
  };

  const [dbCourses, setDbCourses] = useState([]);
  const [dbClasses, setDbClasses] = useState([]);

  React.useEffect(() => {
    Promise.all([
      apiClient.fetchCurriculum('matrix'),
      apiClient.fetchCurriculum('class')
    ]).then(([crs, cls]) => {
      setDbCourses(crs || []);
      setDbClasses(cls || []);
    });
  }, []);

  const matrixDisciplinesMap = React.useMemo(() => {
    const map = {};
    (dbCourses || []).forEach(course => {
       course.series?.forEach(serie => {
          serie.disciplines?.forEach(d => {
             if (d.id && d.name) map[d.id] = d.name;
          });
       });
    });
    return map;
  }, [dbCourses]);

  const enrichScheduleItem = React.useCallback((s) => {
    if (!s) return null;
    const classObj = dbClasses.find(c => String(c.id) === String(s.classId));
    const courseObj = dbCourses.find(c => String(c.id) === String(s.courseId));
    
    const discName = matrixDisciplinesMap[s.disciplineId] || 
                     disciplinesMeta?.[s.disciplineId]?.name || 
                     subjectHoursMeta?.[s.disciplineId]?.name || 
                     s.subjectName || s.subject || 'Disciplina';

    const teacherName = s.teacherId 
      ? String(s.teacherId).split(',').map(id => resolveTeacherName(id, globalTeachers)).join(' / ')
      : 'A Definir';

    let extraRecs = {};
    try {
      if (s.records) {
        extraRecs = (typeof s.records === 'string') ? JSON.parse(s.records) : s.records;
        if (typeof extraRecs === 'string') extraRecs = JSON.parse(extraRecs);
      }
    } catch (e) {}

    const dCode = isNaN(s.dayOfWeek) ? String(s.dayOfWeek) : String(MAP_DAYS[s.dayOfWeek]);

    return {
      ...s,
      ...extraRecs,
      className: classObj?.name || s.className || s.classId,
      course: courseObj?.course || s.courseName || s.courseId,
      day: dCode,
      dayLabel: dayFullLabels[dCode] || dCode,
      time: s.slotId || s.time,
      subject: discName,
      teacher: teacherName,
      teacherId: String(s.teacherId || '').trim()
    };
  }, [dbClasses, dbCourses, matrixDisciplinesMap, disciplinesMeta, subjectHoursMeta, globalTeachers, dayFullLabels]);

  const mappedSchedules = React.useMemo(() => {
      return (horariosFiltrados || []).map(s => enrichScheduleItem(s)).filter(Boolean);
  }, [horariosFiltrados, enrichScheduleItem]);

  const alunoSummary = React.useMemo(() => {
    if (!selectedClass || !mappedSchedules || !selectedWeek || !academicWeeks || !dbClasses) return { atual: [], previa: [], vagas: [] };
    
    const targetClassObj = dbClasses.find(c => c.name === selectedClass);
    const classIdRef = targetClassObj ? String(targetClassObj.id) : String(selectedClass);

    const getHeaderLabel = (itemDay, weekId) => {
      const dayCode = shortDayMap[itemDay] || itemDay;
      const DayLabel = dayFullLabels[dayCode] || dayCode;
      const targetWeekData = academicWeeks.find(w => String(w.id) === String(weekId || selectedWeek));
      if (!targetWeekData || !targetWeekData.start_date) return DayLabel;
      const cleanDate = String(targetWeekData.start_date).split('T')[0];
      const d = new Date(cleanDate + 'T12:00:00Z');
      const offset = (dayOrder[dayCode] || 1) - 1;
      d.setUTCDate(d.getUTCDate() + offset);
      return `${DayLabel} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    };

    const groupByDay = (items) => {
      const groups = {};
      items.forEach(item => {
        const weekId = item.week_id || item.academic_week_id || item.weekId;
        const code = shortDayMap[item.day] || item.day;
        const groupKey = `${weekId}-${code}`;
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push({ ...item, dayCode: code });
      });
      return Object.entries(groups)
        .map(([key, items]) => {
          const [wId, dCode] = key.split('-');
          const weekIdx = academicWeeks.findIndex(w => String(w.id) === String(wId));
          const sortVal = (weekIdx !== -1 ? weekIdx * 10 : 999) + (dayOrder[dCode] || 99);
          return {
            sortVal,
            dayCode: dCode,
            dayLabel: getHeaderLabel(dCode, wId),
            items: items.sort((a,b) => a.time.localeCompare(b.time))
          };
        }).sort((a,b) => a.sortVal - b.sortVal);
    };

    const nowRef = new Date();
    const refDate = new Date(nowRef);
    if (nowRef.getDay() === 6) refDate.setDate(refDate.getDate() + 2);
    else if (nowRef.getDay() === 0) refDate.setDate(refDate.getDate() + 1);
    refDate.setHours(0,0,0,0);

    const actualCurrentWeek = academicWeeks.find(w => {
        const s = new Date(String(w.start_date).split('T')[0] + 'T00:00:00'); 
        const e = new Date(String(w.end_date).split('T')[0] + 'T23:59:59');
        return refDate >= s && refDate <= e;
    });
    const dashboardBaseWeekId = selectedWeek || (actualCurrentWeek ? String(actualCurrentWeek.id) : (academicWeeks[0] ? String(academicWeeks[0].id) : null));

    const atualRaw = mappedSchedules.filter(s => 
      String(s.classId) === classIdRef && String(s.week_id || s.weekId) === String(dashboardBaseWeekId)
    );
    const atual = groupByDay(atualRaw);
    const vagas = groupByDay(atualRaw.filter(s => !s.teacherId || s.teacherId === 'A Definir' || s.teacherId === ''));

    const currentWeekIdx = academicWeeks.findIndex(w => String(w.id) === String(dashboardBaseWeekId));
    const targetPreviewWeekId = academicWeeks[currentWeekIdx + 1]?.id;
    const previaRaw = targetPreviewWeekId ? schedules.filter(s => 
      s.type === 'previa' && String(s.classId) === classIdRef && String(s.week_id) === String(targetPreviewWeekId)
    ).map(s => enrichScheduleItem(s)).filter(Boolean) : [];
    const previa = groupByDay(previaRaw);

    return { atual, previa, vagas };
  }, [selectedClass, mappedSchedules, schedules, selectedWeek, academicWeeks, enrichScheduleItem, dayOrder, dayFullLabels, shortDayMap]);

  // Auto-seleção do dia atual
  React.useEffect(() => {
     if (!mappedSchedules?.length) return;
     const todayIndex = new Date().getDay();
     const nameOfToday = MAP_DAYS[todayIndex] || 'Segunda-feira';
     if (nameOfToday === 'Sábado' || nameOfToday === 'Domingo') {
         setSelectedDay(mappedSchedules.some(s => s.day === 'Sábado') ? 'Sábado' : 'Segunda-feira');
     } else {
         setSelectedDay(safeDays.includes(nameOfToday) ? nameOfToday : 'Segunda-feira');
     }
  }, [mappedSchedules, safeDays, setSelectedDay]);

  const dynamicCoursesList = React.useMemo(() => {
    const names = new Set([...dbCourses.map(c => c.course), ...mappedSchedules.map(s => s.course)]);
    return ['Todos', ...Array.from(names).filter(Boolean).sort()];
  }, [dbCourses, mappedSchedules]);

  const dynamicClassesList = React.useMemo(() => {
    const names = new Set([...dbClasses.map(c => c.name), ...mappedSchedules.map(s => s.className)]);
    return Array.from(names).filter(Boolean).sort();
  }, [dbClasses, mappedSchedules]);

  const filteredClassesList = React.useMemo(() => {
    if (!selectedCourse || selectedCourse === 'Todos') return dynamicClassesList;
    const courseIds = dbCourses.filter(c => c.course === selectedCourse).map(c => String(c.id));
    let list = courseIds.length > 0 ? dbClasses.filter(c => courseIds.includes(String(c.matrixId))).map(c => c.name) : [];
    if (list.length === 0) list = Array.from(new Set(mappedSchedules.filter(s => s.course === selectedCourse).map(s => s.className)));
    return list.filter(Boolean).sort();
  }, [selectedCourse, dbClasses, dbCourses, dynamicClassesList, mappedSchedules]);

  const dynamicWeeksList = React.useMemo(() => {
    if (!academicWeeks || !schedules) return [];
    const now = new Date();
    now.setHours(0,0,0,0);
    const type = (scheduleMode === 'consolidado' || scheduleMode === 'atual') ? 'oficial' : scheduleMode;
    const modeWeeks = Array.from(new Set(schedules.filter(s => s.type === type && String(s.academic_year) === String(selectedConfigYear)).map(s => String(s.week_id)))).filter(Boolean);
    
    return modeWeeks.map(id => {
      const w = academicWeeks.find(week => String(week.id) === String(id));
      if (!w) return { value: id, label: id };
      const start = String(w.start_date || '').split('T')[0].split('-').reverse().slice(0,2).join('/');
      const end = String(w.end_date || '').split('T')[0].split('-').reverse().slice(0,2).join('/');
      return { value: id, label: `${w.name} (${start} a ${end})` };
    }).sort((a,b) => a.label.localeCompare(b.label));
  }, [schedules, scheduleMode, selectedConfigYear, academicWeeks]);

  React.useEffect(() => {
    if (dynamicWeeksList.length > 0 && (!selectedWeek || !dynamicWeeksList.some(w => w.value === selectedWeek))) {
      setSelectedWeek(dynamicWeeksList[0].value);
    }
  }, [dynamicWeeksList, selectedWeek, setSelectedWeek]);

  // Estatísticas e Labels
  const stats = React.useMemo(() => {
    if (!selectedClass) return { lecionadas: 0, vagas: 0 };
    const classId = dbClasses.find(c => c.name === selectedClass)?.id;
    const oficiales = schedules.filter(s => s.type === 'oficial' && String(s.classId) === String(classId));
    return {
      lecionadas: oficiales.length,
      vagas: oficiais.filter(s => !s.teacherId || s.teacherId === 'A Definir').length
    };
  }, [schedules, selectedClass, dbClasses]);

  const weekLabel = React.useMemo(() => {
      const w = academicWeeks?.find(week => String(week.id) === String(selectedWeek));
      if (!w) return '';
      const fmt = (d) => d?.split('T')[0].split('-').reverse().slice(0,2).join('/') || '';
      return `${String(w.name).toUpperCase()} (${fmt(w.start_date)} a ${fmt(w.end_date)})`;
  }, [academicWeeks, selectedWeek]);

  // RENDERIZAÇÃO
  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
      
      {/* HEADER DO PORTAL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h1 className={`text-2xl font-black ${isDarkMode ? "text-white" : "text-slate-800"}`}>Portal do Aluno</h1>
            <p className={`text-sm font-medium opacity-60 ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`}>IFRO - Gestão de Horários Acadêmicos</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
          {[
            { id: 'dashboard', label: 'Painel', icon: Home },
            { id: 'hoje', label: 'Hoje', icon: Clock },
            { id: 'gradeturma', label: 'Horário Semanal', icon: CalendarDays }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${viewMode === tab.id ? "bg-emerald-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* VIEW: DASHBOARD */}
      {viewMode === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-4 duration-700">
          
          {/* COLUNA ESQUERDA: RESUMO */}
          <div className="lg:col-span-8 space-y-8">
            <div className={`p-8 rounded-[2.5rem] border glass-card ${isDarkMode ? "bg-slate-900/40 border-slate-700" : "bg-white/60 border-emerald-100 shadow-xl shadow-emerald-500/5"}`}>
              
              <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                    <Calendar size={24} />
                  </div>
                  <h2 className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-slate-800"}`}>Minha Agenda</h2>
                </div>

                <div className="flex p-1 bg-slate-100 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800">
                  {['atual', 'vagas', 'previa'].map(t => (
                    <button
                      key={t}
                      onClick={() => setDashboardTab(t)}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${dashboardTab === t ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-emerald-500"}`}
                    >
                      {t === 'atual' ? 'Semana Atual' : t === 'vagas' ? 'Aulas Vagas' : 'Próxima Semana'}
                    </button>
                  ))}
                </div>
              </div>

              {/* FILTROS DE TURMA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Curso</label>
                  <SearchableSelect options={dynamicCoursesList} value={selectedCourse} onChange={handleCourseChange} isDarkMode={isDarkMode} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Turma</label>
                  <SearchableSelect options={filteredClassesList} value={selectedClass} onChange={handleClassChange} isDarkMode={isDarkMode} />
                </div>
              </div>

              {/* LISTAGEM DE AULAS */}
              <div className="space-y-6">
                {(alunoSummary[dashboardTab] || []).map(group => (
                  <div key={group.dayLabel} className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {group.dayLabel}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.items.map((aula, idx) => (
                        <div key={idx} className={`p-4 rounded-2xl border border-dashed transition-all duration-300 hover:scale-[1.02] ${isDarkMode ? "bg-slate-800/30 border-slate-700 hover:border-emerald-500/50" : "bg-white border-slate-100 hover:bg-emerald-50/30 hover:border-emerald-200"}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center border border-slate-200 dark:border-slate-700">
                                <span className="text-[10px] font-black text-emerald-600">{aula.time}</span>
                              </div>
                              <div>
                                <p className={`text-sm font-bold ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>{aula.subject}</p>
                                <p className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                                  <UserCircle size={10} /> {aula.teacher}
                                </p>
                              </div>
                            </div>
                            {aula.is_substituicao && <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[8px] font-black rounded-full uppercase">Substituição</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {(!alunoSummary[dashboardTab] || alunoSummary[dashboardTab].length === 0) && (
                  <div className="flex flex-col items-center justify-center py-12 opacity-40">
                    <Search size={48} className="mb-4 text-slate-300" />
                    <p className="text-sm font-medium">Nenhuma aula programada para este período.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: ACESSOS RÁPIDOS */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* CARD ESTATÍSTICAS */}
            <div className={`p-6 rounded-[2rem] border ${isDarkMode ? "bg-emerald-900/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-100"}`}>
              <h3 className={`text-sm font-black uppercase tracking-widest mb-4 ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`}>Visão Geral</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center group">
                  <span className="text-xs font-bold text-slate-500">Horas Aula (Total)</span>
                  <span className="text-sm font-black text-emerald-600">{stats.lecionadas}</span>
                </div>
                <div className="h-px bg-slate-200 dark:bg-slate-800" />
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Aulas Vagas (Semana)</span>
                  <span className={`text-sm font-black ${stats.vagas > 0 ? "text-amber-500" : "text-emerald-600"}`}>{stats.vagas}</span>
                </div>
              </div>
            </div>

            {/* LINKS ÚTEIS */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Sistemas IFRO</h3>
              {[
                { label: 'SUAP IFRO', icon: Globe, url: 'https://suap.ifro.edu.br', color: 'blue' },
                { label: 'AVA Acadêmico', icon: Monitor, url: 'https://ava.ifro.edu.br', color: 'emerald' },
                { label: 'BIBLIOTECA', icon: Book, url: 'https://biblioteca.ifro.edu.br', color: 'amber' }
              ].map(link => (
                <a key={link.label} href={link.url} target="_blank" rel="noreferrer" className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 hover:translate-x-1 ${isDarkMode ? "bg-slate-900 border-slate-800 hover:border-emerald-500/30" : "bg-white border-slate-100 hover:border-emerald-200 shadow-sm"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-${link.color}-500 text-white`}><link.icon size={16} /></div>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{link.label}</span>
                  </div>
                  <ExternalLink size={14} className="text-slate-400" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: HOJE */}
      {viewMode === "hoje" && (
        <div className="animate-in fade-in zoom-in duration-500 space-y-8">
           <div className={`p-8 rounded-[3rem] border glass-card ${isDarkMode ? "bg-slate-900/40 border-slate-700 shadow-2xl" : "bg-white/60 border-emerald-100 shadow-2xl shadow-emerald-500/5"}`}>
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
                <div className="flex items-center gap-5">
                   <div className="w-16 h-16 bg-emerald-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
                      <Clock size={32} />
                   </div>
                   <div>
                      <h2 className={`text-2xl font-black ${isDarkMode ? "text-white" : "text-slate-800"}`}>Agenda do Dia</h2>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-500">{selectedDay} • {weekLabel}</p>
                   </div>
                </div>

                <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                  {safeDays.map(d => (
                    <button key={d} onClick={() => setSelectedDay(d)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${selectedDay === d ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"}`}>
                      {d.split('-')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                 {mappedSchedules.filter(s => s.day === selectedDay && (selectedClass === 'Todos' || s.className === selectedClass)).sort((a,b) => a.time.localeCompare(b.time)).map((aula, idx) => (
                    <div key={idx} className={`group relative p-6 rounded-[2rem] border transition-all duration-500 hover:translate-y-[-4px] ${isDarkMode ? "bg-slate-800/40 border-slate-700 hover:border-emerald-500/50" : "bg-white border-slate-100 hover:border-emerald-200 hover:shadow-xl shadow-emerald-500/5"}`}>
                        <div className="flex items-center justify-between mb-4">
                           <div className="px-3 py-1 bg-emerald-600/10 text-emerald-600 text-[10px] font-black rounded-lg uppercase tracking-widest">{aula.time}</div>
                           {aula.is_vaga ? <AlertCircle size={18} className="text-amber-500 animate-pulse" /> : <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                        </div>
                        <h4 className={`text-lg font-black mb-1 ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>{aula.subject}</h4>
                        <div className="flex items-center gap-2 mb-4">
                           <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500">{aula.teacher?.charAt(0)}</div>
                           <span className="text-xs font-bold text-slate-400">{aula.teacher}</span>
                        </div>
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{aula.className}</span>
                           {aula.is_substituicao && <span className="text-[9px] font-bold text-amber-500">Substituição</span>}
                        </div>
                    </div>
                 ))}
                 {mappedSchedules.filter(s => s.day === selectedDay && (selectedClass === 'Todos' || s.className === selectedClass)).length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-30">
                       <ClipboardList size={64} className="mb-4" />
                       <p className="text-lg font-black uppercase tracking-widest">Sem atividades agendadas</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* VIEW: GRADE TURMA (SEMANAL COMPLETA) */}
      {viewMode === "gradeturma" && (
        <div className="animate-in fade-in duration-700 space-y-6">
          <div className={`p-8 rounded-[3rem] border glass-card ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-2xl"}`}>
             
             <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
               <div className="flex items-center gap-4">
                 <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl">
                   <CalendarDays size={28} />
                 </div>
                 <div>
                   <h2 className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-slate-800"}`}>Quadro Semanal</h2>
                   <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest">{selectedClass} • {weekLabel}</p>
                 </div>
               </div>

               <div className="flex flex-wrap items-center gap-4">
                  <div className="w-64">
                    <SearchableSelect options={dynamicWeeksList} value={selectedWeek} onChange={handleWeekChange} isDarkMode={isDarkMode} />
                  </div>
                  <button onClick={() => window.print()} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-400">
                    <Printer size={20} />
                  </button>
               </div>
             </div>

             <div className="overflow-x-auto no-scrollbar rounded-3xl border border-slate-200 dark:border-slate-800 shadow-inner">
                <ClassGrid 
                   isDarkMode={isDarkMode}
                   activeDays={safeDays}
                   classTimes={safeTimes}
                   schedules={mappedSchedules}
                   selectedClass={selectedClass}
                   enrichScheduleItem={enrichScheduleItem}
                />
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
