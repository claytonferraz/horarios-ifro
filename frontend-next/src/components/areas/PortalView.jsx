import React, { useState } from 'react';
import { 
  ChevronDown, Clock, Printer, CheckCircle, Eye, BookOpen, FileText, Users,
  MessageSquare, Send, CheckCircle2, XCircle, AlertCircle, GripVertical,
  Calendar, UserCircle, Layers, AlertTriangle, BarChart3, ListTodo, CalendarDays, Settings
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { SearchableSelect } from '../ui/SearchableSelect';
import { InlineInput } from '../ui/InlineInput';
import { ScheduleEditorModal } from '../ui/admin/ScheduleEditorModal';
import { TeacherExchangeModal } from '../ui/TeacherExchangeModal';
import { ScheduleNotifications } from '../ui/admin/ScheduleNotifications';
import { MAP_DAYS, getColorHash, isTeacherPending, resolveTeacherName } from '@/lib/dates';
import { useData } from '@/contexts/DataContext';
import { apiClient } from '@/lib/apiClient';

export function PortalView({
  appMode, isDarkMode, viewMode, setViewMode, scheduleMode, setScheduleMode, userRole, siape,
  selectedCourse, setSelectedCourse, selectedClass, setSelectedClass, selectedTeacher, setSelectedTeacher,
  totalFilterYear, setTotalFilterYear, totalFilterTeacher, setTotalFilterTeacher, totalFilterClass, setTotalFilterClass, totalFilterSubject, setTotalFilterSubject,
  courses, classesList, globalTeachersList, availableYearsForTotal, availableTeachersForTotal, availableClassesForTotal, availableSubjectsForTotal,
  alunoStats, diarioStats, finalFilteredTotalData, bimestresData, recordsForWeek,
  activeData, handlePrint, getColorHash, isTeacherPending,
  selectedDay, setSelectedDay, selectedWeek, setSelectedWeek, activeWeeksList,
  getCellRecords, activeCourseClasses, profStats, activeDays, classTimes, rawData, loadAdminMetadata
}) {
  const { globalTeachers, refreshData, subjectHoursMeta, intervals, selectedConfigYear, disciplinesMeta, schedules, academicWeeks } = useData();

  const horariosFiltrados = React.useMemo(() => {
    if (!schedules || !Array.isArray(schedules)) return [];
    
    return schedules.filter(schedule => {
      if (String(schedule.academic_year) !== String(selectedConfigYear)) return false;
      if (schedule.type !== scheduleMode) return false;
      if (scheduleMode !== 'padrao' && String(schedule.week_id) !== String(selectedWeek)) return false;
      // Pre-filtering removed: PortalView internal loops will filter locally using actual resolved text strings
      return true;
    });
  }, [schedules, selectedConfigYear, scheduleMode, selectedWeek]);
  const [editorModal, setEditorModal] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showVacantInMyClasses, setShowVacantInMyClasses] = useState(false);
  const [vacantRequestModal, setVacantRequestModal] = useState(null);
  const [alertModal, setAlertModal] = useState(null);

  React.useEffect(() => {
    if (appMode === 'aluno') {
      const savedCourse = localStorage.getItem('ifro_aluno_course');
      const savedClass = localStorage.getItem('ifro_aluno_class');
      if (savedCourse && typeof setSelectedCourse === 'function') {
        setSelectedCourse(savedCourse);
      }
      if (savedClass && typeof setSelectedClass === 'function') {
        setTimeout(() => setSelectedClass(savedClass), 150);
      }
    }
  }, [appMode, setSelectedCourse, setSelectedClass]);

  React.useEffect(() => {
    if (appMode === 'aluno') {
      if (selectedCourse && selectedCourse !== 'Todos') {
        localStorage.setItem('ifro_aluno_course', selectedCourse);
      }
      if (selectedClass) {
        localStorage.setItem('ifro_aluno_class', selectedClass);
      }
    }
  }, [appMode, selectedCourse, selectedClass]);

  const loadPendingRequests = React.useCallback(() => {
    if (selectedWeek) {
      apiClient.fetchRequests().then(reqs => {
        if (reqs) {
          setPendingRequests(reqs.filter(r => (r.status === 'pendente' || r.status === 'pending') && r.week_id === selectedWeek));
        }
      }).catch(e => console.error("Error fetching requests for alerts", e));
    }
  }, [selectedWeek]);

  React.useEffect(() => {
    loadPendingRequests();
  }, [loadPendingRequests, scheduleMode]);

  const [draggingRecord, setDraggingRecord] = useState(null);
  const [exchangeTarget, setExchangeTarget] = useState(null);

  const isSlotLocked = React.useCallback((r) => {
      return pendingRequests.some(req => {
          try {
              let prop = req.proposed_slot;
              if (typeof prop === 'string' && prop.startsWith('{')) prop = JSON.parse(prop);
              if (typeof prop === 'string' && prop.startsWith('"')) prop = JSON.parse(prop);
              if (typeof prop === 'string' && prop.startsWith('{')) prop = JSON.parse(prop);
              return String(prop.day) === String(r.day) && String(prop.time) === String(r.time) && String(prop.className) === String(r.className);
          } catch(e) { return false; }
      });
  }, [pendingRequests]);

  const checkConflict = (record, dDay, dTime, dCls) => {
    if (!record || !record.teacher || record.teacher === 'A Definir' || record.teacher === '-') return null;
    const sameTeacherOtherClass = activeData.find(r => r.id !== record.id && r.teacher === record.teacher && r.day === dDay && r.time === dTime && r.className !== dCls);
    if (sameTeacherOtherClass) return 'Choque de horário';
    
    // Check 3 turnos
    const timeObj = safeTimes.find(t => t.timeStr === dTime);
    if (timeObj) {
      const shift = timeObj.shift;
      const todayRecords = activeData.filter(r => r.id !== record.id && r.teacher === record.teacher && r.day === dDay);
      const shifts = new Set(todayRecords.map(r => safeTimes.find(t => t.timeStr === r.time)?.shift).filter(Boolean));
      shifts.add(shift);
      if (shifts.size > 2) return 'Professor em 3 turnos';
    }

    // Check sala (se tiver room)
    if (record.room && record.room !== '-') {
      const roomOccupied = activeData.find(r => r.id !== record.id && r.room === record.room && r.day === dDay && r.time === dTime && r.className !== dCls);
      if (roomOccupied) return 'Ocupação de sala';
    }
    return null;
  };

  const onDragStart = (start) => {
    const record = activeData.find(r => r.id === start.draggableId);
    setDraggingRecord(record || null);
  };

  const onDragEnd = async (result) => {
    setDraggingRecord(null);
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const recordId = draggableId;
    const record = activeData.find(r => r.id === recordId);
    if (!record) return;

    let dDay, dTime, dCls;
    if (destination.droppableId === 'unallocated') {
      dDay = 'A Definir';
      dTime = 'A Definir';
      dCls = record.className;
    } else {
      [dDay, dTime, dCls] = destination.droppableId.split('|');
    }

    try {
      const updatedRecord = { 
        ...record, 
        day: dDay, 
        time: dTime, 
        className: dCls 
      };

      // Optimistic Update (Prevent Ghost Effect)
      record.day = dDay;
      record.time = dTime;
      record.className = dCls;
      
      // Update via API
      await apiClient.updateScheduleRecord(selectedWeek, updatedRecord);
      if (typeof refreshData === 'function') await refreshData();
    } catch (e) {
      alert("Erro ao mover aula: " + e.message);
      // Rollback on Error
      if (typeof refreshData === 'function') await refreshData();
    }
  };

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

  const estatisticasProfessor = React.useMemo(() => {
    if (!schedules || !Array.isArray(schedules)) return { totalAulasOficiais: 0, semanasComRegistro: 0 };
    const targetProf = appMode === 'professor' ? siape : selectedTeacher;
    if (!targetProf) return { totalAulasOficiais: 0, semanasComRegistro: 0 };
    
    const bSchedules = schedules.filter(s => 
      s.type === 'oficial' && 
      String(s.academic_year) === String(selectedConfigYear) &&
      s.teacherId && String(s.teacherId).split(',').includes(String(targetProf))
    );
    const weeks = new Set(bSchedules.map(r => r.week_id).filter(Boolean));
    return {
      totalAulasOficiais: bSchedules.length,
      semanasComRegistro: weeks.size
    };
  }, [schedules, selectedConfigYear, appMode, siape, selectedTeacher]);

  const [dbCourses, setDbCourses] = useState([]);
  const [dbClasses, setDbClasses] = useState([]);

  React.useEffect(() => {
    Promise.all([
      apiClient.fetchCurriculum('matrix'),
      apiClient.fetchCurriculum('class')
    ]).then(([crs, cls]) => {
      setDbCourses(crs || []);
      setDbClasses(cls || []);
    }).catch(e => console.error("Falha ao carregar dicionários", e));
  }, []);

   const matrixDisciplinesMap = React.useMemo(() => {
     const map = {};
     (dbCourses || []).forEach(course => {
        if (course.series && Array.isArray(course.series)) {
           course.series.forEach(serie => {
              if (serie.disciplines && Array.isArray(serie.disciplines)) {
                 serie.disciplines.forEach(d => {
                    if (d.id && d.name) map[d.id] = d.name;
                 });
              }
           });
        }
     });
     return map;
   }, [dbCourses]);

   const mappedSchedules = React.useMemo(() => {
       return horariosFiltrados.map(s => {
           const classObj = dbClasses.find(c => String(c.id) === String(s.classId));
           const courseObj = dbCourses.find(c => String(c.id) === String(s.courseId));
           // Use local dictionary mapping, then backend JOINed name, then raw string just passing through
           const discName = matrixDisciplinesMap[s.disciplineId] || disciplinesMeta?.[s.disciplineId]?.name || subjectHoursMeta?.[s.disciplineId]?.name || s.subjectName || (s.disciplineId && s.disciplineId.length > 20 ? 'Disciplina Desconhecida' : s.disciplineId) || 'Disciplina Desconhecida';
           
           let extraRecs = {};
           try { if(s.records) extraRecs = JSON.parse(s.records); } catch(e){}

           return {
               id: s.id,
               course: courseObj ? courseObj.course : (s.courseName || s.courseId),
               className: classObj ? classObj.name : (s.className || s.classId),
               day: MAP_DAYS[s.dayOfWeek],
               time: s.slotId,
               subject: discName,
               teacher: s.teacherId ? String(s.teacherId).split(',').map(id => resolveTeacherName(id, globalTeachers)).join(',') : 'A Definir',
               teacherId: s.teacherId || '',
               room: s.room || '',
               ...extraRecs,
               raw: s
           };
       });
   }, [horariosFiltrados, dbClasses, dbCourses, disciplinesMeta, subjectHoursMeta, globalTeachers, matrixDisciplinesMap]);

   const dynamicCoursesList = React.useMemo(() => {
     return ['Todos', ...[...new Set(dbCourses.map(c => c.course))].filter(Boolean).sort((a,b) => a.localeCompare(b))];
   }, [dbCourses]);

   const dynamicClassesList = React.useMemo(() => {
     return [...new Set(dbClasses.map(c => c.name))].filter(Boolean).sort((a,b) => a.localeCompare(b));
   }, [dbClasses]);

   const filteredClassesList = React.useMemo(() => {
     if (!selectedCourse || selectedCourse === 'Todos' || selectedCourse === '') {
       return dynamicClassesList;
     }
     
     // Find the selected course IDs (because multiple matrices can have the same course link):
     const courseObjs = dbCourses.filter(c => c.course === selectedCourse);
     if (courseObjs.length === 0) return dynamicClassesList;

     const validMatrixIds = courseObjs.map(c => String(c.id));

     // Filter classes by this course ID correctly linking relational ID
     const classesForCourse = dbClasses
       .filter(c => validMatrixIds.includes(String(c.matrixId)))
       .map(c => c.name)
       .filter(Boolean)
       .sort((a,b) => a.localeCompare(b));

     return classesForCourse.length > 0 ? classesForCourse : dynamicClassesList;
   }, [selectedCourse, dbClasses, dbCourses, dynamicClassesList]);

   const dynamicWeeksList = React.useMemo(() => {
     if (!schedules || !Array.isArray(schedules) || !academicWeeks) return [];
     const modeSchedules = schedules.filter(s => s.type === scheduleMode && String(s.academic_year) === String(selectedConfigYear));
     
     let uniqueWeekIds = [...new Set(modeSchedules.map(s => String(s.week_id)))].filter(Boolean);

     // Regra Aluno Prévia Estrita: Apenas exibir prévia na exata Próxima Semana letiva
     if (appMode === 'aluno' && scheduleMode === 'previa') {
         const now = new Date();
         const refDate = new Date(now);
         if (now.getDay() === 6) refDate.setDate(refDate.getDate() + 2);
         else if (now.getDay() === 0) refDate.setDate(refDate.getDate() + 1);
         refDate.setHours(0,0,0,0);
         
         const sortedWeeks = [...academicWeeks].sort((a,b) => new Date(a.start_date) - new Date(b.start_date));
         const currWeekIndex = sortedWeeks.findIndex(w => {
             const s = new Date(w.start_date + 'T00:00:00'); 
             const e = new Date(w.end_date + 'T23:59:59');
             return refDate >= s && refDate <= e;
         });
         
         let nextWeekId = null;
         if (currWeekIndex !== -1 && currWeekIndex + 1 < sortedWeeks.length) {
             nextWeekId = String(sortedWeeks[currWeekIndex + 1].id);
         } else {
             const fallback = sortedWeeks.find(w => new Date(w.start_date + 'T00:00:00') > refDate);
             if (fallback) nextWeekId = String(fallback.id);
         }
         
         if (nextWeekId) {
             uniqueWeekIds = uniqueWeekIds.filter(id => id === nextWeekId);
         } else {
             uniqueWeekIds = []; // Nenhum alvo no futuro letivo aplicável
         }
     }
     
     return uniqueWeekIds.map(id => {
        const weekObj = academicWeeks.find(w => String(w.id) === String(id));
        let labelStr = id;
        if (weekObj) {
           const fmt = (iso) => {
              if (!iso) return '';
              const parts = iso.split('-');
              if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
              return iso;
           };
           const start = fmt(weekObj.start_date);
           const end = fmt(weekObj.end_date);
           labelStr = start && end ? `${weekObj.name} (${start} a ${end})` : (weekObj.name || id);
        }
        return {
           value: id,
           label: labelStr
        };
     }).sort((a,b) => b.label.localeCompare(a.label));
   }, [schedules, scheduleMode, selectedConfigYear, academicWeeks, appMode]);

   React.useEffect(() => {
     if (dynamicWeeksList.length > 0) {
        const validValues = dynamicWeeksList.map(w => w.value);
        if (!selectedWeek || !validValues.includes(selectedWeek)) {
           if (typeof setSelectedWeek === 'function') setSelectedWeek(validValues[0]);
        }
     }
   }, [dynamicWeeksList, selectedWeek, setSelectedWeek]);

   React.useEffect(() => {
     if (selectedCourse && selectedCourse !== 'Todos' && selectedClass) {
        if (!filteredClassesList.includes(selectedClass) && typeof setSelectedClass === 'function') {
           setSelectedClass('');
        }
     }
   }, [selectedCourse, filteredClassesList, selectedClass, setSelectedClass]);

   const handleAlunoScheduleTab = React.useCallback((mode) => {
       setScheduleMode(mode);
       if (academicWeeks && academicWeeks.length > 0 && typeof setSelectedWeek === 'function') {
           const now = new Date();
           
           // Regra de Negócio: A semana vira no Sábado (6) à 00:01.
           // Se for Sábado (6) ou Domingo (0), avançamos a data de referência para a Segunda-feira.
           const refDate = new Date(now);
           if (now.getDay() === 6) {
               refDate.setDate(refDate.getDate() + 2);
           } else if (now.getDay() === 0) {
               refDate.setDate(refDate.getDate() + 1);
           }
           refDate.setHours(0,0,0,0);

           const sortedWeeks = [...academicWeeks].sort((a,b) => new Date(a.start_date) - new Date(b.start_date));
           
           // Encontra o index da semana que contém a data de referência
           const currWeekIndex = sortedWeeks.findIndex(w => {
               // Adicionando T00:00:00 para evitar bugs de fuso horário UTC na conversão da string
               const s = new Date(w.start_date + 'T00:00:00'); 
               const e = new Date(w.end_date + 'T23:59:59');
               return refDate >= s && refDate <= e;
           });

           if (mode === 'oficial') {
               const currWeek = currWeekIndex !== -1 ? sortedWeeks[currWeekIndex] : sortedWeeks[0];
               if (currWeek) setSelectedWeek(String(currWeek.id));
           } else if (mode === 'previa') {
               // Próxima semana será o index atual + 1
               let nextWeek;
               if (currWeekIndex !== -1 && currWeekIndex + 1 < sortedWeeks.length) {
                   nextWeek = sortedWeeks[currWeekIndex + 1];
               } else {
                   // Fallback de segurança: primeira semana no futuro
                   nextWeek = sortedWeeks.find(w => new Date(w.start_date + 'T00:00:00') > refDate) || sortedWeeks[sortedWeeks.length - 1];
               }
               if (nextWeek) setSelectedWeek(String(nextWeek.id));
           }
       }
   }, [academicWeeks, setScheduleMode, setSelectedWeek]);

   React.useEffect(() => {
       if (appMode === 'aluno' && academicWeeks && academicWeeks.length > 0 && !selectedWeek) {
           handleAlunoScheduleTab('oficial'); 
       }
   }, [appMode, academicWeeks, selectedWeek, handleAlunoScheduleTab]);

   const estatisticasAluno = React.useMemo(() => {
       if (!schedules || schedules.length === 0 || !selectedClass || !dbClasses) return { lecionadas: 0, semProfessorSemana: 0, aReporTotal: 0 };
       const classObj = dbClasses.find(c => c.name === selectedClass);
       const classId = classObj ? String(classObj.id) : String(selectedClass);
       const oficiaisTurma = schedules.filter(s => s.type === 'oficial' && String(s.classId) === classId);
       const lecionadas = oficiaisTurma.length;
       const aReporTotal = oficiaisTurma.filter(s => !s.teacherId || String(s.teacherId) === 'A Definir' || String(s.teacherId) === '-').length;
       const vagasSemana = mappedSchedules.filter(s => String(s.className) === String(selectedClass) && (!s.teacher || String(s.teacher) === 'A Definir' || String(s.teacher) === '-')).length;
       return { lecionadas, semProfessorSemana: vagasSemana, aReporTotal };
   }, [schedules, mappedSchedules, selectedClass, dbClasses]);

   const weekLabel = React.useMemo(() => {
       if (!selectedWeek || !academicWeeks) return '';
       const w = academicWeeks.find(week => String(week.id) === String(selectedWeek));
       if (!w) return '';
       const fmtDate = (d) => {
           if (!d) return '';
           const parts = d.split('T')[0].split('-');
           return parts.length === 3 ? parts[2] + '/' + parts[1] : d;
       };
       return String(w.name).replace(/semana\s*/i, 'SEM ') + ' (' + fmtDate(w.start_date) + ' a ' + fmtDate(w.end_date) + ')';
   }, [academicWeeks, selectedWeek]);

  return (
    <>
        {(!schedules || schedules.length === 0) ? (
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
              <div className={`flex items-center justify-between border-b pb-3 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                <div className={`flex flex-wrap items-center gap-2 p-1.5 rounded-xl shadow-inner w-full ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
                  
                  {appMode === 'professor' && (
                    <>
                      {/* Destaques Professor */}
                      <button onClick={() => { setViewMode('professor'); if(['servidor', 'admin', 'gestao'].includes(userRole) && typeof setSelectedTeacher === 'function') setSelectedTeacher(siape); }} 
                              className={`flex-1 sm:flex-none min-w-[140px] flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${viewMode === 'professor' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 ring-2 ring-indigo-400/50' : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200')}`}>
                        <UserCircle size={16} /> Meu Horário
                      </button>
                      <button onClick={() => setViewMode('total')} 
                              className={`flex-1 sm:flex-none min-w-[140px] flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${viewMode === 'total' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/40 ring-2 ring-amber-400/50' : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200')}`}>
                        <BarChart3 size={16} /> Controle de Aulas
                      </button>

                      {/* Dropdown Outras Ações (Professor) */}
                      <div className="relative group ml-auto flex-1 sm:flex-none">
                        <button className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${['outro_professor', 'curso', 'sem_professor'].includes(viewMode) ? (isDarkMode ? 'bg-slate-800 border border-slate-700 text-emerald-400' : 'bg-white border border-slate-300 text-emerald-600') : (isDarkMode ? 'bg-slate-800/50 text-slate-400 hover:text-slate-200' : 'bg-white/50 text-slate-500 hover:text-slate-800 border border-transparent')}`}>
                          <Settings size={14} /> Mais Funções
                        </button>
                        <div className={`absolute right-0 sm:right-0 lg:left-0 lg:right-auto top-full mt-2 w-56 rounded-xl shadow-2xl p-2 z-[99] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
                           <button onClick={() => setViewMode('outro_professor')} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all mb-1 ${viewMode === 'outro_professor' ? (isDarkMode ? 'bg-slate-900 text-cyan-400' : 'bg-slate-100 text-cyan-600') : (isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-50 text-slate-600')}`}><Users size={14} /> Ver Colegas</button>
                           <button onClick={() => setViewMode('curso')} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all mb-1 ${viewMode === 'curso' ? (isDarkMode ? 'bg-slate-900 text-rose-400' : 'bg-slate-100 text-rose-600') : (isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-50 text-slate-600')}`}><Layers size={14} /> Horário dos Cursos</button>
                           <button onClick={() => setViewMode('sem_professor')} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'sem_professor' ? (isDarkMode ? 'bg-slate-900 text-red-400' : 'bg-slate-100 text-red-600') : (isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-50 text-slate-600')}`}><AlertTriangle size={14} /> Aulas Vagas</button>
                        </div>
                      </div>
                    </>
                  )}

                  {appMode === 'aluno' && (
                    <>
                      {/* Destaques Aluno */}
                      <button onClick={() => setViewMode('hoje')} 
                              className={`flex-1 sm:flex-none min-w-[140px] flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${viewMode === 'hoje' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 ring-2 ring-blue-400/50' : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200')}`}>
                        <ListTodo size={16} /> Painel Diário
                      </button>
                      <button onClick={() => setViewMode('turma')} 
                              className={`flex-1 sm:flex-none min-w-[140px] flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${viewMode === 'turma' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 ring-2 ring-emerald-400/50' : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200')}`}>
                        <Calendar size={16} /> Minha Turma
                      </button>

                      {/* Dropdown Outras Ações (Aluno) */}
                      <div className="relative group ml-auto flex-1 sm:flex-none">
                        <button className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${viewMode === 'professor' ? (isDarkMode ? 'bg-slate-800 border border-slate-700 text-indigo-400' : 'bg-white border border-slate-300 text-indigo-600') : (isDarkMode ? 'bg-slate-800/50 text-slate-400 hover:text-slate-200' : 'bg-white/50 text-slate-500 hover:text-slate-800 border border-transparent')}`}>
                          <Settings size={14} /> Mais Funções
                        </button>
                        <div className={`absolute right-0 sm:right-0 lg:left-0 lg:right-auto top-full mt-2 w-56 rounded-xl shadow-2xl p-2 z-[99] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
                           <button onClick={() => setViewMode('professor')} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all mb-1 ${viewMode === 'professor' ? (isDarkMode ? 'bg-slate-900 text-indigo-400' : 'bg-slate-100 text-indigo-600') : (isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-50 text-slate-600')}`}><UserCircle size={14} /> Buscar Professor</button>
                        </div>
                      </div>
                    </>
                  )}
                  
                </div>
              </div>

              {/* Filtros Específicos para renderização */}
              {viewMode !== 'curso' && viewMode !== 'sem_professor' && (
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 rounded-xl border no-print ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                  {(viewMode === 'turma' || viewMode === 'hoje') && (
                    <>
                      <div className="space-y-1 lg:col-span-2"><label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1">Filtrar por Curso</label>
                        <SearchableSelect isDarkMode={isDarkMode} options={dynamicCoursesList} value={selectedCourse} onChange={setSelectedCourse} colorClass={isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-sm' : 'bg-white border-slate-200 text-slate-700 shadow-sm'} />
                      </div>
                      <div className="space-y-1 lg:col-span-2"><label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1">Visualizar Turma</label>
                        <SearchableSelect isDarkMode={isDarkMode} options={filteredClassesList} value={selectedClass} onChange={setSelectedClass} colorClass={scheduleMode === 'previa' ? (isDarkMode ? "bg-violet-900/30 border-violet-800/50 text-violet-200 shadow-sm" : "bg-violet-50 border-violet-100 text-violet-900 shadow-sm") : viewMode === 'hoje' ? (isDarkMode ? "bg-blue-900/30 border-blue-800/50 text-blue-200 shadow-sm" : "bg-blue-50 border-blue-100 text-blue-900 shadow-sm") : (isDarkMode ? "bg-emerald-900/30 border-emerald-800/50 text-emerald-200 shadow-sm" : "bg-emerald-50 border-emerald-100 text-emerald-900 shadow-sm")} />
                      </div>
                    </>
                  )}
                  {(viewMode === 'professor' && appMode === 'aluno') || viewMode === 'outro_professor' ? (
                    <div className="space-y-1 col-span-full md:col-span-2">
                      <label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1">
                        Buscar Professor
                      </label>
                      <SearchableSelect 
                        isDarkMode={isDarkMode} 
                        options={(globalTeachers || [])
                          .filter(t => t && (t.siape || t.id))
                          .map(t => ({value: String(t.siape || t.id), label: t.nome_exibicao || t.nome_completo || t.name || 'Professor Sem Nome', raw: t}))
                          .sort((a,b) => String(a.label).localeCompare(String(b.label)))} 
                        value={selectedTeacher} 
                        onChange={setSelectedTeacher} 
                        colorClass={isDarkMode ? "bg-indigo-900/30 border-indigo-800/50 text-indigo-200 shadow-sm" : "bg-indigo-50 border-indigo-100 text-indigo-900 shadow-sm"} 
                      />
                    </div>
                  ) : null}
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
                    <span className={`text-2xl font-black leading-none ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{estatisticasAluno.lecionadas}</span>
                    <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-800/60'}`}>Aulas Já Lecionadas</p>
                  </div>
                  <div className={`border p-3 rounded-xl text-center shadow-sm ${isDarkMode ? 'bg-orange-900/20 border-orange-800/50' : 'bg-orange-50 border-orange-100'}`}>
                    <span className={`text-2xl font-black leading-none ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>{estatisticasAluno.semProfessorSemana}</span>
                    <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-orange-300' : 'text-orange-800/60'}`}>Aulas Vagas ({scheduleMode === 'previa' ? 'prévia' : 'semana'})</p>
                  </div>
                  <div className={`border p-3 rounded-xl text-center shadow-sm ${isDarkMode ? 'bg-red-900/20 border-red-800/50' : 'bg-red-50 border-red-100'}`}>
                    <span className={`text-2xl font-black leading-none ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{estatisticasAluno.aReporTotal}</span>
                    <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-red-300' : 'text-red-800/60'}`}>Total a repor</p>
                  </div>
                </div>
              )}

              {/* ESTATÍSTICAS - PORTAL DO PROFESSOR */}
              {(viewMode === 'professor' || viewMode === 'outro_professor') && selectedTeacher && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className={`border p-3 rounded-xl text-center shadow-sm ${isDarkMode ? 'bg-indigo-900/20 border-indigo-800/50' : 'bg-indigo-50 border-indigo-100'}`}>
                    <span className={`text-2xl font-black leading-none ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{estatisticasProfessor.totalAulasOficiais}</span>
                    <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-800/60'}`}>Total de Aulas Dadas</p>
                  </div>
                  <div className={`border p-3 rounded-xl text-center shadow-sm ${isDarkMode ? 'bg-blue-900/20 border-blue-800/50' : 'bg-blue-50 border-blue-100'}`}>
                    <span className={`text-2xl font-black leading-none ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{estatisticasProfessor.semanasComRegistro} Semanas</span>
                    <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-blue-300' : 'text-blue-800/60'}`}>Carga Cumprida</p>
                  </div>
                  <div className={`border p-3 rounded-xl text-center shadow-sm ${isDarkMode ? 'bg-emerald-900/20 border-emerald-800/50' : 'bg-emerald-50 border-emerald-100'}`}>
                    <span className={`text-2xl font-black leading-none ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{horariosFiltrados.length}</span>
                    <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-800/60'}`}>Aulas nesta semana</p>
                  </div>
                </div>
              )}
            </div>

            {/* OPÇÕES DE BASE DE DADOS (Movido para perto da tabela) */}
            {viewMode !== 'total' && (
              <div className={`border p-2.5 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 mb-2 no-print ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`flex border p-1 rounded-xl w-full md:w-auto shrink-0 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  {appMode === 'aluno' ? (
                    <>
                      <button onClick={() => handleAlunoScheduleTab('oficial')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scheduleMode === 'oficial' ? 'bg-emerald-500 text-white shadow-md' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}`}>
                        <Calendar size={14} /> Horário da Semana
                      </button>
                      <button onClick={() => handleAlunoScheduleTab('previa')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scheduleMode === 'previa' ? 'bg-violet-500 text-white shadow-md' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}`}>
                        <Eye size={14} /> Próxima Semana
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setScheduleMode('oficial')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scheduleMode === 'oficial' ? 'bg-emerald-500 text-white shadow-md' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}`}>
                        <Calendar size={14} /> Horário Consolidado
                      </button>
                      <button onClick={() => setScheduleMode('previa')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scheduleMode === 'previa' ? 'bg-violet-500 text-white shadow-md' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}`}>
                        <Eye size={14} /> Prévia
                      </button>
                      <button onClick={() => setScheduleMode('padrao')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scheduleMode === 'padrao' ? 'bg-blue-500 text-white shadow-md' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}`}>
                        <BookOpen size={14} /> Padrão Anual
                      </button>
                    </>
                  )}
                </div>

                {scheduleMode !== 'padrao' && appMode !== 'aluno' && dynamicWeeksList.length > 0 && (
                    <div className={`p-1 flex items-center gap-2 rounded-lg border cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <CalendarDays size={18} className={`shrink-0 ml-2 opacity-50 ${isDarkMode ? 'text-white' : 'text-slate-700'}`} />
                    <SearchableSelect isDarkMode={isDarkMode} options={dynamicWeeksList} value={selectedWeek} onChange={setSelectedWeek} colorClass={`bg-transparent border-none font-black uppercase tracking-tighter text-[11px] ${isDarkMode ? 'text-white' : 'text-slate-900'}`} placeholder="Selecione..." />
                  </div>
                  )}
              </div>
            )}

            {/* ÁREA ENCAPSULADA DE EXIBIÇÃO E IMPRESSÃO */}
            <div id="printable-area">
              
              {/* TRATAMENTO DE ESTADO VAZIO */}
              {viewMode !== 'total' && scheduleMode !== 'padrao' && (dynamicWeeksList.length === 0 || horariosFiltrados.length === 0) ? (
                <div className={`rounded-2xl border p-12 text-center shadow-sm no-print ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  {scheduleMode === 'previa' ? <Eye size={36} className={`mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} /> : <Calendar size={36} className={`mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />}
                  <h3 className={`text-lg font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                    {appMode === 'aluno' 
                        ? (scheduleMode === 'previa' ? 'Sem Prévia Publicada' : 'Sem Aulas na Semana')
                        : (scheduleMode === 'previa' ? 'Nenhuma Prévia Disponível' : 'Nenhuma Planilha Oficial')}
                  </h3>
                  <p className={`text-sm font-medium mt-1 max-w-md mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {appMode === 'aluno'
                        ? (scheduleMode === 'previa' ? 'A prévia do horário para a próxima semana ainda não foi publicada pela coordenação. Retorne em breve!' : 'Não há aulas programadas para a sua turma nesta semana letiva.')
                        : (scheduleMode === 'previa' ? 'Não há prévias arquivadas cujas datas pertençam às próximas semanas.' : 'Não há dados oficiais ativos no momento correspondentes à aba selecionada.')}
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
                           {weekLabel && <span className="text-[9px] font-black bg-white/10 px-3 py-1 rounded-full tracking-widest uppercase shadow-inner ml-2">{weekLabel}</span>}
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

                               const records = mappedSchedules.filter(r => {
                                  if (r.day !== selectedDay || r.time !== time) return false;
                                  if (appMode === 'aluno' && r.className !== selectedClass) return false;
                                  if (appMode === 'professor' && viewMode === 'hoje') {
                                     if (!r.teacherId.includes(String(siape))) return false;
                                  }
                                  return true;
                               });

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
                                                <div key={r.id} className={`p-3 rounded-lg border flex flex-col sm:flex-row justify-between sm:items-center gap-2 shadow-sm relative overflow-hidden ${isPending ? (isDarkMode ? 'bg-red-900/30 border-red-800/50 text-red-300' : 'bg-red-50 border-red-200 text-red-800') : getColorHash(r.subject, isDarkMode)}`}>
                                                   {r.isSubstituted && (
                                                      <div className="absolute top-0 right-0 z-10 pointer-events-none print:hidden">
                                                          <span title="Assumida no lugar de uma Vaga" className="text-[7px] font-black uppercase tracking-wide text-white px-2 py-0.5 rounded-bl-[8px] bg-indigo-600 border-l border-b border-indigo-700 block animate-pulse shadow-sm shadow-indigo-900/30">Substituição</span>
                                                      </div>
                                                   )}
                                                   <div className="pt-2 sm:pt-0">
                                                      <p className={`font-black text-sm leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                                        {r.subject} {r.isSubstituted && r.originalSubject && <span className="block text-[8px] sm:text-[9.5px] opacity-80 mt-1 uppercase">Era: {r.originalSubject}</span>}
                                                      </p>
                                                      <p className={`text-[10px] font-bold uppercase tracking-wider mt-1.5 ${isPending ? (isDarkMode ? 'text-red-400' : 'text-red-600') : 'opacity-80'}`}>{isPending ? 'Sem Professor' : resolveTeacherName(r.teacher, globalTeachers)}</p>
                                                   </div>
                                                   {r.room && <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md self-start sm:self-auto shrink-0 mt-2 sm:mt-0 shadow-sm ${isDarkMode ? 'bg-white/20' : 'bg-black/10'}`}>{r.room}</span>}
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
                    <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
                    <div className="flex flex-col lg:flex-row gap-4 animate-in zoom-in-95 duration-500">
                      <div className="flex-1 space-y-6">
                      {(() => {
                        const currentCourses = [...new Set(mappedSchedules.map(r => r.course))].filter(Boolean);
                        const availableCourses = currentCourses.sort((a,b) => a.localeCompare(b));

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
                          const courseClassesGlobais = mappedSchedules.filter(r => r.course === course).map(r => r.className);
                          const courseClasses = [...new Set(courseClassesGlobais)].sort();
                          const courseRecords = mappedSchedules.filter(r => r.course === course);

                          if (courseClasses.length === 0) return null;

                          return (
                            <div key={course} className={`print:break-inside-avoid print:break-after-page rounded-2xl shadow-sm print:shadow-none border print:border-none overflow-hidden print:overflow-visible mb-6 print:mb-0 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                              <div className={`text-white px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print ${scheduleMode === 'padrao' ? (isDarkMode ? 'bg-blue-950' : 'bg-blue-900') : scheduleMode === 'previa' ? (isDarkMode ? 'bg-violet-950' : 'bg-violet-900') : (isDarkMode ? 'bg-rose-950' : 'bg-rose-900')}`}>
                                <div className="flex items-center gap-2.5">
                                  <Layers size={18} className="opacity-80" />
                                  <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                    {scheduleMode === 'padrao' && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">PADRÃO</span>}
                                    {scheduleMode === 'previa' && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">PRÉVIA</span>}
                                    Horário dos Cursos: {course}
                                  </h2>
                                  {scheduleMode !== 'padrao' && <span className="text-[9px] font-black bg-white/20 px-3 py-1 rounded-full tracking-widest uppercase shadow-sm ml-2">{dynamicWeeksList.find(w => w.value === selectedWeek)?.label || selectedWeek}</span>}
                                </div>
                                <button onClick={handlePrint} className="hidden md:flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 no-print">
                                  <Printer size={14} /> Imprimir Horário do Curso
                                </button>
                              </div>
                              <div className="hidden print:block font-black text-[14px] uppercase mb-2 border-b-[3px] border-black pb-2 tracking-widest mt-4">
                                {course} <span className="float-right font-medium text-[10px] bg-black text-white px-2 py-1 rounded-sm">{scheduleMode === 'padrao' ? 'HORÁRIO PADRÃO' : (dynamicWeeksList.find(w => w.value === selectedWeek)?.label || selectedWeek)}</span>
                              </div>
                              <div className="hidden md:block overflow-x-auto print:overflow-visible">
                                <table className="w-full min-w-[800px] border-collapse relative text-xs print:w-full print:min-w-0">
                                  <thead>
                                    <tr className={`border-b text-[9px] font-black uppercase tracking-widest text-slate-400 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                      <th className={`sticky left-0 z-30 py-3 px-2 border-r-[3px] w-10 min-w-[40px] text-center shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>Dia</th>
                                      <th className={`sticky left-[40px] z-20 py-3 px-3 border-r-[3px] w-28 min-w-[112px] text-center shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>Horário<br/><span className="text-[8px] font-normal opacity-70 normal-case">{selectedWeek}</span></th>
                                      {courseClasses.map(cls => (
                                        <th key={cls} className={`py-3 px-4 border-r-[3px] last:border-r-0 text-center ${isDarkMode ? 'border-slate-700 text-slate-200' : 'border-slate-300 text-slate-800'}`}>{cls}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                                    {safeDays.map((day, dayIndex) => {
                                      const dayRecords = courseRecords.filter(r => r.day === day);
                                      const dayShifts = new Set(dayRecords.map(r => safeTimes.find(t => t.timeStr === r.time)?.shift).filter(Boolean));
                                      const displayShiftsDay = new Set();
                                      if (dayShifts.has('Matutino')) displayShiftsDay.add('Matutino');
                                      if (dayShifts.has('Vespertino')) displayShiftsDay.add('Vespertino');
                                      if (dayShifts.has('Noturno')) displayShiftsDay.add('Noturno');
                                      
                                      const activeTimes = safeTimes.filter(t => displayShiftsDay.has(t.shift));
                                      const hasClassesToday = dayRecords.length > 0;

                                      if (!hasClassesToday || activeTimes.length === 0) {
                                        return (
                                          <React.Fragment key={`day-block-${day}-empty`}>
                                            <tr className="group transition-colors print:hidden">
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
                                              <tr className={`border-y-[4px] print:hidden ${isDarkMode ? 'bg-slate-700/40 border-slate-700' : 'bg-slate-300/40 border-slate-300'}`}>
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
                                                      className={`p-1 border-r-[3px] last:border-r-0 align-top min-w-[140px] transition-all ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}
                                                    >
                                                       <Droppable droppableId={`${day}|${time}|${cls}`}>
                                                          {(provided, snapshot) => {
                                                             let conflictMsg = null;
                                                             if (draggingRecord && snapshot.isDraggingOver) {
                                                                conflictMsg = checkConflict(draggingRecord, day, time, cls);
                                                             }
                                                             return (
                                                               <div ref={provided.innerRef} {...provided.droppableProps} 
                                                                 onClick={() => {
                                                                     if (['admin','gestao'].includes(userRole)) setEditorModal({ cls, day, time, tObj: timeObj });
                                                                 }}
                                                                 className={`w-full h-full min-h-[50px] p-0.5 rounded-lg transition-colors ${['admin','gestao'].includes(userRole) ? 'cursor-pointer hover:ring-2 hover:ring-indigo-500 hover:z-30 relative' : ''} ${conflictMsg ? 'bg-red-500/20 ring-2 ring-red-500 !bg-red-500/20' : snapshot.isDraggingOver ? (isDarkMode ? 'bg-slate-700/50' : 'bg-slate-100') : (isDarkMode ? 'group-hover:bg-slate-700/30 bg-slate-800/20' : 'group-hover:bg-slate-50/50 bg-slate-50/20')}`}
                                                               >
                                                                  {conflictMsg && snapshot.isDraggingOver && <div className="absolute -top-6 left-0 bg-red-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded z-50 whitespace-nowrap shadow-md">{conflictMsg}</div>}
                                                                  {records.length > 0 ? records.map((r, rIndex) => {
                                                                      const isPending = isTeacherPending(r.teacher);
                                                                      return (
                                                                         <Draggable key={r.id} draggableId={r.id} index={rIndex} isDragDisabled={!(scheduleMode === 'previa' && ['admin','gestao'].includes(userRole))}>
                                                                           {(prov2, snap2) => (
                                                                             <div ref={prov2.innerRef} {...prov2.draggableProps} {...prov2.dragHandleProps} 
                                                                               className={`print-clean-card p-1.5 print:p-1 rounded-xl print:rounded-none border-b-[3px] print:border-b-[1px] print:border-slate-400 shadow-sm print:shadow-none flex flex-col justify-center min-h-[46px] print:min-h-0 transition-all mb-1 print:mb-0 last:mb-0 hover:scale-[1.02] relative overflow-visible ${snap2.isDragging ? 'shadow-xl scale-105 z-50' : ''} ${isPending ? (isDarkMode ? 'bg-red-900/30 border-red-800/50 text-red-300' : 'bg-red-50 border-red-300 text-red-800') : getColorHash(r.subject, isDarkMode)}`}
                                                                             >
                                                                                {r.isSubstituted && (
                                                                                   <div className="absolute -top-1.5 -right-1 z-10 print:hidden shadow-sm pointer-events-none">
                                                                                     <span title="Aula assumida de Vaga via Troca" className="text-[5px] font-black uppercase tracking-widest text-white px-1.5 py-[2px] rounded border border-indigo-400 bg-indigo-600 block animate-pulse shadow-sm shadow-indigo-900/40">Substituição</span>
                                                                                   </div>
                                                                                )}
                                                                                <p className={`subject font-bold text-[10px] print:text-[8.5px] leading-tight print:leading-[1.1] mb-1 print:mb-0.5 text-center ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                                                                  {r.subject} {r.isSubstituted && r.originalSubject && <span className="block text-[8px] sm:text-[9px] opacity-80 mt-1 uppercase">Era: {r.originalSubject}</span>}
                                                                                </p>
                                                                                <p className={`text-[8.5px] print:text-[7.5px] font-medium leading-none text-center opacity-90 ${isPending ? (isDarkMode ? 'text-red-400 font-bold' : 'text-red-600 font-bold') : ''}`}>
                                                                                  {resolveTeacherName(r.teacher, globalTeachers)} {r.room && <span className="font-black opacity-80 print:opacity-100">| S: {r.room}</span>}
                                                                                </p>
                                                                             </div>
                                                                           )}
                                                                        </Draggable>
                                                                     );
                                                                  }) : <div className={`h-[46px] print:min-h-[22px] flex items-center justify-center font-black text-[9px] tracking-widest uppercase select-none pointer-events-none ${isDarkMode ? 'opacity-20' : 'opacity-5'}`}>-</div>}
                                                                  {provided.placeholder}
                                                               </div>
                                                             );
                                                          }}
                                                       </Droppable>
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
                              <div className="md:hidden no-print p-4 space-y-4">
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
                                              const displayShifts = new Set();
                                              if (dayShifts.has('Matutino')) displayShifts.add('Matutino');
                                              if (dayShifts.has('Vespertino')) displayShifts.add('Vespertino');
                                              if (dayShifts.has('Noturno')) displayShifts.add('Noturno');
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

                      {/* Sidebar de Elementos Nao Alocados e Notificacoes */}
                      {['admin','gestao'].includes(userRole) && scheduleMode === 'previa' && (
                        <div className="w-full lg:w-72 shrink-0 space-y-4 sticky top-20 flex flex-col items-end no-print">
                          
                          <ScheduleNotifications 
                            recordsForWeek={activeData} 
                            subjectHoursMeta={subjectHoursMeta} 
                            isDarkMode={isDarkMode} 
                          />

                          <div className={`w-full rounded-2xl border shadow-sm p-4 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                            <h3 className={`text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                              <ListTodo size={16}/> Staging Area / Pendentes
                            </h3>
                            <Droppable droppableId="unallocated">
                              {(provided, snapshot) => (
                                <div ref={provided.innerRef} {...provided.droppableProps} className={`space-y-3 min-h-[300px] p-2 rounded-xl transition-colors ${snapshot.isDraggingOver ? (isDarkMode ? 'bg-slate-700/50' : 'bg-slate-50') : 'bg-transparent'}`}>
                                  {mappedSchedules.filter(r => !r.day || r.day === 'A Definir' || r.day === '-').map((r, index) => (
                                    <Draggable key={r.id} draggableId={r.id} index={index}>
                                      {(prov2, snap2) => (
                                        <div ref={prov2.innerRef} {...prov2.draggableProps} {...prov2.dragHandleProps} className={`p-4 rounded-xl border shadow-sm transition-all hover:scale-[1.02] cursor-grab active:cursor-grabbing ${snap2.isDragging ? 'shadow-2xl scale-[1.04] z-50 ring-2 ring-indigo-500' : 'hover:shadow-md'} ${getColorHash(r.subject, isDarkMode)}`}>
                                          <p className={`font-black text-xs leading-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{r.subject}</p>
                                          <p className={`text-[10px] font-bold mt-1.5 opacity-80 uppercase tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{r.className} <br/><span className="mt-1 block opacity-80">{resolveTeacherName(r.teacher, globalTeachers)}</span></p>
                                          {r.room && <span className={`inline-block mt-3 bg-black/10 text-center px-2 py-1 rounded text-[8px] font-black uppercase tracking-[0.2em]`}>{r.room}</span>}
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                  {mappedSchedules.filter(r => !r.day || r.day === 'A Definir' || r.day === '-').length === 0 && (
                                    <div className={`h-full flex flex-col items-center justify-center opacity-30 text-center py-10 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                       <ListTodo size={32} className="mb-2"/>
                                       <span className="text-[10px] font-black uppercase tracking-[0.2em]">Nenhum bloco<br/>estacionado</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        </div>
                      )}

                    </div>
                    </DragDropContext>
                  )}

                  {/* GRADE DE HORÁRIO DO PROFESSOR (Separada por Curso) */}
                  {(viewMode === 'professor' || viewMode === 'outro_professor') && selectedTeacher && (
                    <div className="flex flex-col xl:flex-row gap-6 items-start animate-in zoom-in-95 duration-500">
                      
                      {/* Lado Esquerdo: Grade (70%) */}
                      <div className={`w-full ${appMode === 'professor' && viewMode === 'professor' && ['servidor', 'admin', 'gestao'].includes(userRole) ? 'xl:w-[70%]' : ''} space-y-6`}>
                        {(() => {
                          const baseProfRecords = mappedSchedules.filter(r => r.teacherId && String(r.teacherId).split(',').includes(String(selectedTeacher)));
                        const profClasses = new Set(baseProfRecords.map(r => r.className));
                        let profRecords = [...baseProfRecords];
                        if (showVacantInMyClasses) {
                          const vagas = mappedSchedules.filter(r => isTeacherPending(r.teacher) && profClasses.has(r.className));
                          profRecords = [...profRecords, ...vagas];
                        }
                        const profCourses = [...new Set(profRecords.map(r => r.course))].sort((a,b) => String(a).localeCompare(String(b)));

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
                                    Horário: {resolveTeacherName(selectedTeacher, globalTeachers)} - {course}
                                  </h2>
                                  {scheduleMode !== 'padrao' && <span className="text-[9px] font-black bg-white/20 px-3 py-1 rounded-full tracking-widest uppercase shadow-sm ml-2">{dynamicWeeksList.find(w => w.value === selectedWeek)?.label || selectedWeek}</span>}
                                </div>
                                <div className="flex items-center justify-end">
                                  {appMode === 'professor' && viewMode === 'professor' && (
                                    <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest cursor-pointer bg-black/20 px-3 py-1.5 rounded-lg hover:bg-black/30 transition-colors text-white mr-2 no-print">
                                      <input type="checkbox" checked={showVacantInMyClasses} onChange={e => setShowVacantInMyClasses(e.target.checked)} className="accent-white" />
                                      Mostrar Vagas nas Minhas Turmas
                                    </label>
                                  )}
                                  <button onClick={handlePrint} className="hidden md:flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 no-print">
                                    <Printer size={14} /> Imprimir Horário
                                  </button>
                                </div>
                              </div>

                              <div className="hidden md:block overflow-x-auto">
                                <table className="w-full min-w-[600px] border-collapse relative text-xs">
                                  <thead>
                                    <tr className={`border-b text-[9px] font-black uppercase tracking-widest text-slate-400 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                      <th className={`sticky left-0 z-30 py-3 px-2 border-r-[3px] w-10 min-w-[40px] text-center shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>Dia</th>
                                      <th className={`sticky left-[40px] z-20 py-3 px-3 border-r-[3px] w-28 min-w-[112px] text-center shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>Horário<br/><span className="text-[8px] font-normal opacity-70 normal-case">{selectedWeek}</span></th>
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
                                                    const recordsNesteSlot = courseRecords.filter(r => r.day === day && r.time === timeStr && r.className === cls);

                                                    return (
                                                      <td key={`prof-${cls}-${timeStr}`} className={`p-1 border align-top relative ${isDarkMode ? 'border-slate-700 group-hover:bg-slate-700/30' : 'border-slate-200 group-hover:bg-slate-50/50'}`}>
                                                        <div className="flex flex-col gap-1 w-full h-full min-h-[76px]">
                                                          {recordsNesteSlot.length === 0 ? (
                                                            <div className={`flex items-center justify-center h-full font-black text-[9px] tracking-widest uppercase select-none flex-1 ${isDarkMode ? 'opacity-20' : 'opacity-5'}`}>-</div>
                                                          ) : (
                                                            recordsNesteSlot.map((r, idx) => {
                                                              const isVaga = isTeacherPending(r.teacher);
                                                              const hasClash = recordsNesteSlot.length > 1;
                                                              const isLocked = isVaga && isSlotLocked(r);
                                                              return (
                                                                <div
                                                                  key={r.id || idx}
                                                                  onClick={() => {
                                                                    if (appMode === 'professor') {
                                                                      if (isVaga) {
                                                                        if (isLocked) {
                                                                           alert("Esta vaga já está sendo analisada pela direção.");
                                                                           return;
                                                                        }
                                                                        if (typeof setVacantRequestModal === 'function') setVacantRequestModal(r);
                                                                      } else if (typeof setExchangeTarget === 'function') {
                                                                        setExchangeTarget({ targetClass: r.className, targetCourse: r.course, originalRecord: r });
                                                                      }
                                                                    }
                                                                  }}
                                                                  className={`print-clean-card p-2 rounded-xl border shadow-sm flex flex-col justify-center min-h-[76px] transition-all relative ${isLocked ? (isDarkMode ? 'bg-slate-800/80 border-slate-700 opacity-60 cursor-not-allowed' : 'bg-slate-200 border-slate-300 opacity-60 cursor-not-allowed') : (isVaga ? (isDarkMode ? 'bg-red-900/30 border-red-800/50 hover:scale-[1.02] cursor-pointer' : 'bg-red-50 border-red-300 hover:scale-[1.02] cursor-pointer') : `${getColorHash(r.className, isDarkMode)} hover:scale-[1.02] cursor-pointer`)} ${hasClash && isVaga && !isLocked ? ' ring-2 ring-amber-500 animate-pulse' : ''}`}
                                                                >
                                                                  {isVaga ? (
                                                                    <React.Fragment>
                                                                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-max z-10">
                                                                        <span className={`text-[9px] font-black uppercase tracking-widest text-white px-2 py-0.5 rounded shadow-sm ${isLocked ? 'bg-slate-500' : (isDarkMode ? 'bg-red-600 shadow-red-900' : 'bg-red-600 shadow-red-200')}`}>{isLocked ? 'EM ANÁLISE' : 'AULA VAGA'}</span>
                                                                      </div>
                                                                      <p className={`subject font-black text-xs leading-snug text-center mt-1 ${isLocked ? 'text-slate-400' : (isDarkMode ? 'text-red-100' : 'text-red-950')}`}>{r.subject || 'Pendente'}</p>
                                                                      <span className={`details text-[10px] font-black tracking-widest px-1.5 py-0.5 rounded mt-1.5 w-fit uppercase mx-auto ${isLocked ? 'bg-slate-700/50 text-slate-300' : (isDarkMode ? 'bg-red-900/80 text-red-100' : 'bg-red-200 text-red-950')}`}>{r.className} {r.room ? '- ' + r.room : ''}</span>
                                                                    </React.Fragment>
                                                                  ) : (
                                                                    <React.Fragment>
                                                                      <p className="subject font-black text-xs sm:text-sm leading-snug text-center drop-shadow-sm">
                                                                         {r.subject} {r.isSubstituted && r.originalSubject && <span className="block text-[8px] sm:text-[9px] opacity-80 mt-1 uppercase">Era: {r.originalSubject}</span>}
                                                                      </p>
                                                                      <span className={`details text-[10px] sm:text-xs font-black tracking-widest px-2 py-1 rounded mt-1.5 w-fit uppercase mx-auto shadow-sm ${isDarkMode ? 'bg-white/25 text-white' : 'bg-black/10 text-slate-900'}`}>{r.className} {r.room ? '- ' + r.room : ''}</span>
                                                                      {r.isSubstituted && (
                                                                         <div className="absolute top-0 right-0 z-10 pointer-events-none print:hidden">
                                                                           <span title="Assumida no lugar de uma Vaga" className="text-[6px] font-black uppercase tracking-wide text-white px-1.5 py-0.5 rounded-bl-[8px] bg-indigo-600 border-l border-b border-indigo-700 block animate-pulse shadow-sm shadow-indigo-900/30">Substituição</span>
                                                                         </div>
                                                                      )}
                                                                    </React.Fragment>
                                                                  )}
                                                                </div>
                                                              );
                                                            })
                                                          )}
                                                        </div>
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
                              <div className="md:hidden no-print p-4 space-y-4">
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
                                                    <div key={`mob-rec-${r.id}`} className={`p-2.5 rounded-lg border shadow-sm flex flex-col justify-center ${isPending ? (isDarkMode ? 'bg-red-900/30 border-red-800/50 text-red-300' : 'bg-red-50 border-red-200 text-red-900') : getColorHash(r.className, isDarkMode)}`}>
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

                      {/* Lado Direito: Solicitações (30%) */}
                      {appMode === 'professor' && viewMode === 'professor' && ['servidor', 'admin', 'gestao'].includes(userRole) && (
                        <div className="w-full xl:w-[30%] shrink-0 sticky top-20 no-print">
                          <TeacherRequestsSection 
                            isDarkMode={isDarkMode}
                            siape={selectedTeacher}
                            selectedWeek={selectedWeek}
                            weekData={recordsForWeek.filter(r => r.teacher === selectedTeacher)}
                            activeDays={activeDays}
                            classTimes={classTimes}
                          />
                        </div>
                      )}
                      
                    </div>
                  )}

                  {/* GRADE DE HORÁRIO GERAL (Turma COMPLETA) */}
                  {viewMode === 'turma' && (
                    <div className="space-y-4">
                      {/* ALERTS DE SOLICITAÇÃO NA PRÉVIA */}
                      {(appMode === 'admin' || userRole === 'gestao' || userRole === 'admin') && scheduleMode === 'previa' && pendingRequests.length > 0 && (
                        <div className={`p-4 rounded-xl border shadow-sm flex items-start gap-4 animate-in slide-in-from-top-2 ${isDarkMode ? 'bg-amber-900/30 border-amber-800/50' : 'bg-amber-50 border-amber-200'}`}>
                           <AlertCircle size={24} className="text-amber-500 shrink-0 mt-0.5" />
                           <div>
                              <h4 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>Atenção: Solicitações Pendentes para esta Semana</h4>
                              <p className={`text-xs font-bold mt-1 ${isDarkMode ? 'text-amber-300' : 'text-amber-800'}`}>Você possui {pendingRequests.length} solicitação(ões) de mudança de horário aguardando revisão nesta &quot;Prévia Semanal&quot;. Verifique no painel Administrativo (&quot;Solicitações&quot;).</p>
                           </div>
                        </div>
                      )}
                      
                      <div className={`rounded-2xl shadow-sm border overflow-hidden animate-in zoom-in-95 duration-500 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <div className={`text-white px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print ${scheduleMode === 'padrao' ? (isDarkMode ? 'bg-blue-950' : 'bg-blue-900') : scheduleMode === 'previa' ? (isDarkMode ? 'bg-violet-950' : 'bg-violet-900') : (isDarkMode ? 'bg-emerald-950' : 'bg-emerald-800')}`}>
                        <div className="flex items-center gap-2.5">
                          <Users size={18} className="opacity-80" />
                          <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                            {scheduleMode === 'padrao' && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">PADRÃO</span>}
                            {scheduleMode === 'previa' && <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">PRÉVIA</span>}
                            Grade: {selectedClass}
                          </h2>
                          {scheduleMode !== 'padrao' && weekLabel && <span className="text-[9px] font-black bg-white/10 px-3 py-1 rounded-full tracking-widest uppercase shadow-inner ml-2">{weekLabel}</span>}
                        </div>
                        
                        <button onClick={handlePrint} className="hidden md:flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 no-print">
                          <Printer size={14} /> Imprimir Grade
                        </button>
                      </div>
                      
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full min-w-[750px] border-collapse relative text-xs">
                          <thead>
                            <tr className={`border-b text-[9px] font-black uppercase tracking-widest text-slate-400 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                              <th className={`sticky left-0 z-20 py-3 px-4 border-r-[3px] w-28 text-center ${isDarkMode ? 'bg-slate-900 border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.2)]' : 'bg-slate-100 border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.02)]'}`}>Horário<br/><span className="text-[8px] font-normal opacity-70 normal-case">{selectedWeek}</span></th>
                              {safeDays.map(day => (<th key={day} className={`py-3 px-4 border-r-[3px] last:border-r-0 text-center ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}>{day.split('-')[0]}</th>))}
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                            {(() => {
                              const turmaRecords = mappedSchedules.filter(r => r.className === selectedClass);
                              const entityShifts = new Set(turmaRecords.map(r => safeTimes.find(t => t.timeStr === r.time)?.shift).filter(Boolean));
                              const displayShifts = new Set();
                              if (entityShifts.has('Matutino')) displayShifts.add('Matutino');
                              if (entityShifts.has('Vespertino')) displayShifts.add('Vespertino');
                              if (entityShifts.has('Noturno')) displayShifts.add('Noturno');
                              
                              const entityTimes = safeTimes.filter(t => displayShifts.has(t.shift));

                              let currentShift = '';
                                return (
                                  <DragDropContext onDragEnd={onDragEnd}>
                                    {entityTimes.map((timeObj, index) => {
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
                                            const diaIndex = MAP_DAYS.indexOf(day);
                                            const aulaNesteSlot = turmaRecords.find(r => r.day === day && r.time === time);
                                            const droppableId = `${day}|${time}|${selectedClass}`;
                                            return (
                                              <Droppable droppableId={droppableId} key={droppableId}>
                                                {(provided, snapshot) => (
                                                  <td 
                                                    ref={provided.innerRef}
                                                    {...provided.droppableProps}
                                                    className={`p-1.5 border-r-[3px] last:border-r-0 align-top w-32 transition-colors ${snapshot.isDraggingOver ? (isDarkMode ? 'bg-indigo-900/40' : 'bg-indigo-100/50') : (isDarkMode ? 'border-slate-700 group-hover:bg-slate-700/30 bg-slate-800/20' : 'border-slate-300 group-hover:bg-slate-50/50 bg-slate-50/20')}`}
                                                  >
                                                    {aulaNesteSlot ? (
                                                      <div className="flex flex-col gap-1.5">
                                                        {(() => {
                                                          const isPending = !aulaNesteSlot.teacherId || String(aulaNesteSlot.teacherId) === 'A Definir' || String(aulaNesteSlot.teacherId) === '-';
                                                          const disciplineName = aulaNesteSlot.subject;
                                                          const teacherName = aulaNesteSlot.teacher;
                                                          const hasConflict = false; // Resolved in server side now
                                                          
                                                          return (
                                                            <Draggable key={aulaNesteSlot.id || `dnd-${diaIndex}-${time}`} draggableId={String(aulaNesteSlot.id || `dnd-${diaIndex}-${time}`)} index={0} isDragDisabled={appMode === 'aluno'}>
                                                              {(drgProvided, drgSnapshot) => (
                                                                <div 
                                                                  ref={drgProvided.innerRef}
                                                                  {...drgProvided.draggableProps}
                                                                  {...drgProvided.dragHandleProps}
                                                                  onClick={(e) => {
                                                                    if (appMode !== 'aluno') {
                                                                      setEditorModal({ cls: selectedClass, day, time, tObj: timeObj });
                                                                    }
                                                                  }}
                                                                  className={`print-clean-card p-2 rounded-xl border shadow-sm flex flex-col justify-center min-h-[60px] transition-all relative ${drgSnapshot.isDragging ? 'z-50 scale-105 shadow-2xl rotate-2' : 'hover:scale-[1.02] hover:shadow-md active:scale-95'} ${isPending ? (isDarkMode ? 'bg-red-900/30 border-red-800/50 text-red-300' : 'bg-red-50 border-red-300 text-red-800') : hasConflict ? (isDarkMode ? 'bg-rose-950/80 border-rose-500/80 text-rose-200 shadow-[0_0_10px_rgba(225,29,72,0.4)]' : 'bg-rose-100 border-rose-500 text-rose-900 shadow-[0_0_10px_rgba(225,29,72,0.3)]') : getColorHash(disciplineName, isDarkMode)}`}
                                                                >
                                                                  {appMode !== 'aluno' && (
                                                                    <div className="absolute top-1 right-1 opacity-20 group-hover:opacity-100">
                                                                       <GripVertical size={10} />
                                                                    </div>
                                                                  )}
                                                                  {isPending && <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded w-fit mx-auto mb-0.5 ${isDarkMode ? 'text-red-400 bg-red-900/50' : 'text-red-600 bg-red-100'}`}>SEM PROFESSOR</span>}
                                                                  {aulaNesteSlot.isSubstituted && (
                                                                     <div className="absolute top-0 right-0 z-10 pointer-events-none print:hidden">
                                                                         <span title="Assumida no lugar de uma Vaga" className="text-[6px] font-black uppercase tracking-wide text-white px-1.5 py-0.5 rounded-bl-[8px] bg-indigo-600 border-l border-b border-indigo-700 block animate-pulse shadow-sm shadow-indigo-900/30">Substituição</span>
                                                                     </div>
                                                                  )}
                                                                  <p className="subject font-bold text-[10px] leading-tight mb-0.5 text-center">
                                                                     {disciplineName}
                                                                     {aulaNesteSlot.isSubstituted && aulaNesteSlot.originalSubject && <span className="block text-[8px] sm:text-[9.5px] opacity-80 mt-1 uppercase">Era: {aulaNesteSlot.originalSubject}</span>}
                                                                  </p>
                                                                  <p className="details text-[8px] font-bold opacity-80 flex items-center justify-center gap-1 uppercase truncate">
                                                                    {teacherName}
                                                                  </p>
                                                                  {aulaNesteSlot.room && <span className={`details text-[8px] font-black tracking-tighter opacity-60 px-1.5 py-0.5 rounded mt-1 w-fit uppercase mx-auto ${isDarkMode ? 'bg-white/10' : 'bg-black/5'}`}>{aulaNesteSlot.room}</span>}
                                                                </div>
                                                              )}
                                                            </Draggable>
                                                          );
                                                        })()}
                                                      </div>
                                                    ) : (
                                                      <div className={`w-full h-full min-h-[60px] flex flex-col items-center justify-center p-2 rounded-lg border border-dashed opacity-70 transition-colors ${isDarkMode ? 'bg-slate-800/40 border-slate-600' : 'bg-slate-100 border-slate-300'}`}>
                                                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aula Vaga</span>
                                                          
                                                          {userRole === 'professor' && scheduleMode !== 'padrao' && (
                                                              <button
                                                                  onClick={() => {
                                                                      if(window.confirm(`Deseja solicitar à coordenação para assumir esta Aula Vaga na ${MAP_DAYS[diaIndex]} às ${time}?`)) {
                                                                          alert('Solicitação registrada! A coordenação analisará seu pedido para assumir este horário.');
                                                                      }
                                                                  }}
                                                                  className="mt-2 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-[9px] font-black uppercase tracking-widest rounded-md shadow-sm transition-all active:scale-95 flex items-center gap-1"
                                                              >
                                                                  <CheckCircle size={10} /> Assumir
                                                              </button>
                                                          )}
                                                      </div>
                                                    )}
                                                    {provided.placeholder}
                                                  </td>
                                                )}
                                              </Droppable>
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
                                    })}
                                  </DragDropContext>
                                );
                            })()}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Mobile Stacked View (Turma) */}
                      <div className="md:hidden no-print p-4 space-y-4">
                        {(() => {
                          const turmaRecords = mappedSchedules.filter(r => r.className === selectedClass);
                          if (turmaRecords.length === 0) {
                            return <div className="text-center text-slate-400 font-bold uppercase tracking-widest text-[10px] p-8 border rounded-xl border-dashed">Sem aulas programadas</div>;
                          }
                          return safeDays.map(day => {
                            const dayRecords = turmaRecords.filter(r => r.day === day);
                            if (dayRecords.length === 0) return null;
                            
                            const dayShifts = new Set(dayRecords.map(r => safeTimes.find(t => t.timeStr === r.time)?.shift).filter(Boolean));
                            const displayShifts = new Set();
                            if (dayShifts.has('Matutino')) displayShifts.add('Matutino');
                            if (dayShifts.has('Vespertino')) displayShifts.add('Vespertino');
                            if (dayShifts.has('Noturno')) displayShifts.add('Noturno');
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
                  </div>
                  )}

                  {/* VISTA DE AULAS VAGAS: Separada por Curso */}
                  {viewMode === 'sem_professor' && (
                    <div className="space-y-6 animate-in zoom-in-95 duration-500">
                      {(() => {
                        const pendingRecordsForWeek = mappedSchedules.filter(r => isTeacherPending(r.teacher));
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
                                  {scheduleMode !== 'padrao' && <span className="text-[9px] font-black bg-white/20 px-3 py-1 rounded-full tracking-widest uppercase shadow-sm ml-2">{dynamicWeeksList.find(w => w.value === selectedWeek)?.label || selectedWeek}</span>}
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
                                      <th className={`sticky left-[40px] z-20 py-3 px-3 border-r-[3px] w-28 min-w-[112px] text-center shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>Horário<br/><span className="text-[8px] font-normal opacity-70 normal-case">{selectedWeek}</span></th>
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
                              <div className="md:hidden no-print p-4 space-y-4">
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
            matrixData={[]}
            classesData={classesList || []}
            usersList={globalTeachersList || []}
            classTimes={classTimes}
         />
      )}

      {/* SISTEMA DE SOLICITAÇÕES PARA O PROFESSOR */}
      {vacantRequestModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in zoom-in-95">
          <div className={"w-full max-w-md p-6 rounded-2xl shadow-2xl " + (isDarkMode ? 'bg-slate-800 border border-slate-700 text-white' : 'bg-white text-slate-900')}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black uppercase tracking-widest flex items-center gap-2 text-indigo-500">
                <CheckCircle size={20} /> Assumir Aula Vaga
              </h3>
              <button onClick={() => setVacantRequestModal(null)} className="text-slate-400 hover:text-rose-500"><XCircle size={20} /></button>
            </div>
            <div className={`p-4 rounded-xl mb-4 ${isDarkMode ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
              <p className="text-xs mb-1"><strong>Turma:</strong> {vacantRequestModal.className}</p>
              <p className="text-xs"><strong>Horário:</strong> {vacantRequestModal.day} às {vacantRequestModal.time}</p>
            </div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Qual disciplina você vai lecionar?</label>
            <select id="vacantSubject" className={"w-full p-3 rounded-xl border mb-4 text-xs font-bold outline-none " + (isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200')}>
              <option value="">Selecione a disciplina...</option>
              {[...new Set(mappedSchedules.filter(r => r.teacherId && String(r.teacherId).split(',').includes(String(selectedTeacher || siape)) && r.className === vacantRequestModal.className).map(r => r.subject))].map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setVacantRequestModal(null)} className="flex-1 py-3 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold transition-all hover:bg-slate-300">Cancelar</button>
              <button onClick={() => {
                const subj = document.getElementById('vacantSubject').value;
                if (!subj) return setAlertModal({ title: 'Atenção', message: 'Selecione a disciplina que deseja lecionar antes de enviar o pedido.', type: 'alert' });
                
                apiClient.submitRequest({
                  siape: selectedTeacher || siape,
                  week_id: selectedWeek,
                  description: 'Solicitação para assumir aula vaga na turma ' + vacantRequestModal.className + ' - Disciplina: ' + subj,
                  original_slot: JSON.stringify({ day: vacantRequestModal.day, time: vacantRequestModal.time, type: 'VAGA' }),
                  proposed_slot: { day: vacantRequestModal.day, time: vacantRequestModal.time, className: vacantRequestModal.className, subject: subj, originalSubject: vacantRequestModal.subject, classType: 'Substituição' }
                }).then(() => {
                  setAlertModal({ title: 'Tudo Certo!', message: 'Sua solicitação foi enviada com sucesso à coordenação.', type: 'success' });
                  setVacantRequestModal(null);
                  loadPendingRequests();
                }).catch(e => {
                  setAlertModal({ 
                    title: 'Ops, algo deu errado!', 
                    message: e.message === 'Sessão expirada.' ? 'Sua sessão expirou por segurança. Faça o logout e faça login novamente para enviar a solicitação.' : (e.message || 'Erro ao comunicar com o servidor. Tente novamente.'), 
                    type: 'error' 
                  });
                });
              }} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all shadow-md active:scale-95">Enviar Pedido</button>
            </div>
          </div>
        </div>
      )}

      {exchangeTarget && (
        <TeacherExchangeModal 
          isOpen={true} 
          isDarkMode={isDarkMode}
          onClose={() => setExchangeTarget(null)}
          originalRecord={exchangeTarget.originalRecord}
          targetClass={exchangeTarget.targetClass}
          targetCourse={exchangeTarget.targetCourse}
          classRecords={recordsForWeek.filter(r => r.className === exchangeTarget.targetClass)}
          safeDays={safeDays}
          safeTimes={safeTimes}
          globalTeachers={globalTeachersList}
          apiClient={apiClient}
          selectedWeek={selectedWeek}
        />
      )}

      {/* MODAL GLOBAL ESTILIZADO PARA FEEDBACKS (Ex: Sessão expirada, Sucesso) */}
      {alertModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div className={`w-full max-w-sm p-6 rounded-3xl shadow-2xl flex flex-col items-center text-center ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border`}>
            {alertModal.type === 'error' && <AlertCircle size={48} className={`mb-4 ${isDarkMode ? 'text-rose-400' : 'text-rose-500'}`} />}
            {alertModal.type === 'success' && <CheckCircle size={48} className={`mb-4 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-500'}`} />}
            {alertModal.type === 'alert' && <AlertCircle size={48} className={`mb-4 ${isDarkMode ? 'text-amber-400' : 'text-amber-500'}`} />}
            
            <h3 className={`text-lg font-black mb-2 uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{alertModal.title}</h3>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{alertModal.message}</p>
            
            <button 
              onClick={() => setAlertModal(null)}
              className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-all active:scale-95 ${alertModal.type === 'error' ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]' : alertModal.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-amber-500 hover:bg-amber-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]'}`}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

    </>
  );
}

function TeacherRequestsSection({ isDarkMode, siape, selectedWeek, weekData, activeDays, classTimes }) {
  const [requests, setRequests] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newRequest, setNewRequest] = useState({ description: '', original_slot: '', proposed_day: '', proposed_time: '', proposed_type: 'Regular' });

  const loadRequests = async () => {
    try {
      const data = await apiClient.fetchRequests(siape);
      setRequests(data || []);
    } catch (e) {
      console.error("Erro ao carregar solicitações", e);
    }
  };

  React.useEffect(() => {
    if (siape) loadRequests();
  }, [siape]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.submitRequest({
        siape,
        week_id: selectedWeek,
        description: newRequest.description,
        original_slot: newRequest.original_slot,
        proposed_slot: { day: newRequest.proposed_day, time: newRequest.proposed_time, classType: newRequest.proposed_type }
      });
      setNewRequest({ description: '', original_slot: '', proposed_day: '', proposed_time: '', proposed_type: 'Regular' });
      setIsModalOpen(false);
      loadRequests();
    } catch (err) {
      alert("Erro ao enviar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 mb-12 animate-in slide-in-from-bottom-4 no-print">
      <div className={`rounded-2xl shadow-lg border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`px-6 py-4 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Minhas Solicitações de Mudança</h3>
              <p className={`text-[10px] font-bold opacity-60 uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Coordenação DAPE</p>
            </div>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center gap-2 ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
          >
            <Send size={14} /> Nova Solicitação
          </button>
        </div>

        <div className="p-4">
          {requests.length === 0 ? (
            <div className={`p-10 text-center rounded-xl border-2 border-dashed ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'}`}>
              <MessageSquare size={32} className="mx-auto mb-2 opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">Nenhuma solicitação enviada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(req => (
                <div key={req.id} className={`p-4 rounded-xl border transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-800/70' : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                          Semana: {req.week_id}
                        </span>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1 ${
                          req.status === 'pendente' ? (isDarkMode ? 'bg-amber-900/30 text-amber-500' : 'bg-amber-50 text-amber-600') :
                          req.status === 'aprovado' ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-500' : 'bg-emerald-50 text-emerald-600') :
                          (isDarkMode ? 'bg-rose-900/30 text-rose-500' : 'bg-rose-50 text-rose-600')
                        }`}>
                          {req.status === 'pendente' && <Clock size={10} />}
                          {req.status === 'aprovado' && <CheckCircle2 size={10} />}
                          {req.status === 'rejeitado' && <XCircle size={10} />}
                          {req.status}
                        </span>
                      </div>
                      <p className={`text-xs font-bold leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{req.description}</p>
                      {(req.original_slot || req.proposed_slot) && (
                        <div className={`mt-3 grid grid-cols-2 gap-2 p-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                          <div className={`flex flex-col gap-1 pr-2 border-r ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                            <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>Original</span>
                            <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                              {(() => {
                                try {
                                  let parsed = req.original_slot;
                                  if (typeof parsed === 'string' && parsed.startsWith('{')) parsed = JSON.parse(parsed);
                                  if (typeof parsed === 'string' && parsed.startsWith('"')) parsed = JSON.parse(parsed);
                                  if (typeof parsed === 'string' && parsed.startsWith('{')) parsed = JSON.parse(parsed);
                                  if (typeof parsed === 'object' && parsed !== null) return `VAGA:\n${parsed.day} às ${parsed.time}`;
                                  return String(req.original_slot).replace(/["{}]/g, '');
                                } catch(e) { return String(req.original_slot); }
                              })()}
                            </span>
                          </div>
                          <div className={`flex flex-col gap-1 pl-1`}>
                            <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>Proposta</span>
                             <span className={isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}>
                              {(() => {
                                try {
                                  let parsed = req.proposed_slot;
                                  if (typeof parsed === 'string' && parsed.startsWith('{')) parsed = JSON.parse(parsed);
                                  if (typeof parsed === 'string' && parsed.startsWith('"')) parsed = JSON.parse(parsed);
                                  if (typeof parsed === 'string' && parsed.startsWith('{')) parsed = JSON.parse(parsed);
                                  if (typeof parsed === 'object' && parsed !== null) return `${parsed.subject || parsed.classType || 'Mudança'} - ${parsed.day} às ${parsed.time}`;
                                  return String(req.proposed_slot).replace(/["{}]/g, '');
                                } catch(e) { return String(req.proposed_slot); }
                              })()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    {req.admin_feedback && (
                      <div className={`max-w-[200px] p-3 rounded-lg border text-[10px] animate-in fade-in slide-in-from-right-2 ${isDarkMode ? 'bg-indigo-900/20 border-indigo-800/50 text-indigo-300' : 'bg-indigo-50 border-indigo-100 text-indigo-800'}`}>
                        <div className="flex items-center gap-1.5 mb-1 opacity-70">
                          <AlertCircle size={12} />
                          <span className="font-black uppercase tracking-widest">Feedback DAPE</span>
                        </div>
                        <p className="font-bold leading-relaxed">{req.admin_feedback}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE NOVA SOLICITAÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
            <div className={`px-6 py-5 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800 bg-slate-800/30' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg rotate-3">
                  <Send size={18} />
                </div>
                <div>
                  <h3 className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Nova Solicitação</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Preencha os detalhes da mudança</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Descrição do Pedido</label>
                <textarea 
                  required
                  placeholder="Explique o motivo da solicitação e os detalhes da mudança..."
                  className={`w-full min-h-[100px] p-4 rounded-2xl border text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none resize-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  value={newRequest.description}
                  onChange={e => setNewRequest({...newRequest, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Horário Original (Selecione o slot atual)</label>
                  <select 
                    required
                    className={`w-full p-3.5 rounded-xl border text-xs font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    value={newRequest.original_slot}
                    onChange={e => setNewRequest({...newRequest, original_slot: e.target.value})}
                  >
                     <option value="">Selecione a aula atual</option>
                     {weekData.map(r => (
                        <option key={r.id} value={`${r.day} ${r.time} - ${r.className} (${r.subject})`}>
                           {r.day} {r.time} | Turma: {r.className} | {r.subject}
                        </option>
                     ))}
                  </select>
                </div>
                <div className="space-y-1.5 flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Horário Proposto</label>
                  <div className="flex gap-2">
                     <select required className={`w-1/2 p-2.5 rounded-xl border text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                       value={newRequest.proposed_day} onChange={e => setNewRequest({...newRequest, proposed_day: e.target.value})}
                     >
                       <option value="">Selecione o Dia</option>
                       {activeDays?.map(d => <option key={d} value={d}>{d}</option>)}
                     </select>
                     <select required className={`w-1/2 p-2.5 rounded-xl border text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                       value={newRequest.proposed_time} onChange={e => setNewRequest({...newRequest, proposed_time: e.target.value})}
                     >
                       <option value="">Selecione a Hora</option>
                       {classTimes?.map(t => <option key={t.timeStr} value={t.timeStr}>{t.timeStr} ({t.shift})</option>)}
                     </select>
                  </div>
                  <select required className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none mt-1 ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    value={newRequest.proposed_type} onChange={e => setNewRequest({...newRequest, proposed_type: e.target.value})}
                  >
                    {['Regular', 'Recuperação', 'Exame', 'Atendimento'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className={`p-4 rounded-2xl border flex items-start gap-3 mt-2 ${isDarkMode ? 'bg-amber-900/10 border-amber-800/30 text-amber-500' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold leading-relaxed uppercase tracking-wide">
                  Sua solicitação será analisada pela coordenação. Você receberá o feedback diretamente nesta seção.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2 ${loading ? 'bg-slate-400 cursor-not-allowed text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                >
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={14} />}
                  Enviar Solicitação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
