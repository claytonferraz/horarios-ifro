import React, { useState } from 'react';
import { 
  Calendar, UserCircle, Layers, AlertTriangle, BarChart3, ListTodo, CalendarDays, Settings, Bell, Sun, RefreshCcw, HandHeart, X, ExternalLink, Scissors, MapPin, Monitor, Mail, MessageCircle,
  BookOpen, FileText, Users, CheckCircle, AlertCircle, XCircle, Eye, Clock, Check, Printer
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { SearchableSelect } from '../ui/SearchableSelect';
import { InlineInput } from '../ui/InlineInput';
import { ScheduleEditorModal } from '../ui/admin/ScheduleEditorModal';

import { TeacherOfferModal } from '../ui/TeacherOfferModal';
import { TeacherDirectModal } from '../ui/TeacherDirectModal';
import { ScheduleNotifications } from '../ui/admin/ScheduleNotifications';
import { MAP_DAYS, getColorHash, isTeacherPending, resolveTeacherName } from '@/lib/dates';
import { useData } from '@/contexts/DataContext';
import { apiClient } from '@/lib/apiClient';
import { getSocketClient } from '@/lib/socketClient';
import { CourseGrid } from './grids/CourseGrid';
import { TeacherGrid } from './grids/TeacherGrid';
import { ClassGrid } from './grids/ClassGrid';
import { VacantGrid } from './grids/VacantGrid';
import { TeacherRequestsSection } from '../ui/teacher/TeacherRequestsSection';

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
  const { globalTeachers, refreshData, subjectHoursMeta, intervals, selectedConfigYear, disciplinesMeta, schedules, academicWeeks, bimesters } = useData();

  const horariosFiltrados = React.useMemo(() => {
    if (!schedules || !Array.isArray(schedules)) return [];
    
    const dbType = scheduleMode === 'consolidado' ? 'oficial' : scheduleMode;

    return schedules.filter(schedule => {
      if (String(schedule.academic_year) !== String(selectedConfigYear)) return false;
      if (schedule.type !== dbType) return false;
      if (scheduleMode !== 'padrao' && String(schedule.week_id) !== String(selectedWeek)) return false;
      return true;
    });
  }, [schedules, selectedConfigYear, scheduleMode, selectedWeek]);
  const [editorModal, setEditorModal] = useState(null);
  const [showOnlyMyClasses, setShowOnlyMyClasses] = useState(true);
  const [showEmptySlots, setShowEmptySlots] = useState(false);
  const [padraoFilterTeacher, setPadraoFilterTeacher] = useState('Todos');
  const [selectedColleague, setSelectedColleague] = useState('');
  const [pendingRequests, setPendingRequests] = useState([]);
  
  // New Requests Logic as requested
  const [requests, setRequests] = useState([]);
  const fetchRequests = () => {
    if (appMode === 'professor') {
      apiClient.getRequests().then(data => setRequests(data)).catch(console.error);
    }
  };

  const previousViewMode = React.useRef(viewMode);
  React.useEffect(() => {
    if (appMode === 'professor' && viewMode === 'curso' && previousViewMode.current !== 'curso') {
       if (typeof setScheduleMode === 'function') setScheduleMode('atual');
    }
    previousViewMode.current = viewMode;
  }, [viewMode, appMode, setScheduleMode]);

  React.useEffect(() => { 
    fetchRequests(); 
  }, [appMode]);

  const [showVacantInMyClasses, setShowVacantInMyClasses] = useState(false);
  const [vacantRequestModal, setVacantRequestModal] = useState(null);
  const [teacherDirectModal, setTeacherDirectModal] = useState(null);
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

  const canReadProtectedRequests = React.useMemo(() => {
    if (appMode === 'professor') return !!siape;
    return ['admin', 'gestao'].includes(String(userRole || '').toLowerCase());
  }, [appMode, siape, userRole]);

  const loadPendingRequests = React.useCallback(() => {
    if (!selectedWeek || !canReadProtectedRequests) {
      setPendingRequests([]);
      return;
    }

    apiClient.fetchRequests().then(reqs => {
      if (reqs) {
        setPendingRequests(reqs.filter(r => (r.status === 'pendente' || r.status === 'pending' || r.status === 'aguardando_colega' || r.status === 'pronto_para_homologacao') && r.week_id === selectedWeek));
      }
    }).catch(e => console.error("Error fetching requests for alerts", e));
  }, [selectedWeek, canReadProtectedRequests]);

  React.useEffect(() => {
    loadPendingRequests();
    if (!canReadProtectedRequests) return;

    const socket = getSocketClient();
    const onScheduleUpdated = () => loadPendingRequests();
    socket.on('schedule_updated', onScheduleUpdated);
    return () => socket.off('schedule_updated', onScheduleUpdated);
  }, [loadPendingRequests, scheduleMode, canReadProtectedRequests]);

  const [draggingRecord, setDraggingRecord] = useState(null);
  const [exchangeTarget, setExchangeTarget] = useState(null);
  const [exchangeAction, setExchangeAction] = useState(null);
  const [pendingReverseTarget, setPendingReverseTarget] = useState(null);
  

  const padraoExchangeRecords = React.useMemo(() => {
    if (!exchangeTarget || !exchangeTarget.targetClass || !schedules) return [];
    return schedules
      .filter(s => s.type === 'padrao' && String(s.classId) === String(exchangeTarget.targetClass) && String(s.academic_year) === String(selectedConfigYear))
      .map(s => {
         let recs = {};
         if (typeof s.records === 'string') { try { recs = JSON.parse(s.records); } catch(e){} }
         else recs = s.records || {};
         return {
            id: s.id,
            day: isNaN(s.dayOfWeek) ? String(s.dayOfWeek) : String(MAP_DAYS[s.dayOfWeek]),
            time: s.slotId || s.time,
            subject: s.disciplineId,
            teacher: s.teacherId || '-',
            className: s.classId || s.className,
            course: s.courseName || s.className?.split('-')[0] || '',
            room: recs.room || ''
         };
      });
  }, [exchangeTarget, schedules, selectedConfigYear]);

  const profClassesMemo = React.useMemo(() => {
     if (appMode !== 'professor' || !schedules) return new Set();
     const sf = String(selectedTeacher || siape);
     const classesSet = new Set();
     schedules.forEach(s => {
        if (s.teacherId && String(s.teacherId).split(',').includes(sf)) {
           if (s.className) classesSet.add(String(s.className));
           if (s.classId) classesSet.add(String(s.classId));
        }
     });
     return classesSet;
  }, [appMode, selectedTeacher, siape, schedules]);

  const isSlotInvolvedInPendingRequest = React.useCallback((r) => {
      return pendingRequests.some(req => {
          try {
              let prop = req.proposed_slot;
              if (typeof prop === 'string' && prop.startsWith('{')) prop = JSON.parse(prop);
              if (typeof prop === 'string' && prop.startsWith('"')) prop = JSON.parse(prop);
              if (typeof prop === 'string' && prop.startsWith('{')) prop = JSON.parse(prop);
              
              let orig = req.original_slot;
              if (typeof orig === 'string' && orig.startsWith('{')) orig = JSON.parse(orig);
              if (typeof orig === 'string' && orig.startsWith('"')) orig = JSON.parse(orig);
              if (typeof orig === 'string' && orig.startsWith('{')) orig = JSON.parse(orig);

              const isProp = prop && String(prop.day) === String(r.day) && String(prop.time) === String(r.time) && String(prop.className || prop.classId) === String(r.className || r.classId);
              const isOrig = orig && String(orig.day) === String(r.day) && String(orig.time) === String(r.time) && String(orig.className || orig.classId) === String(r.className || r.classId);
              
              return isProp || isOrig;
          } catch(e) { return false; }
      });
  }, [pendingRequests]);

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

  const checkConflict = React.useCallback((record, dDay, dTime, dCls) => {
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
  }, [activeData, safeTimes]);

  const onDragStart = React.useCallback((start) => {
    const record = activeData.find(r => r.id === start.draggableId);
    setDraggingRecord(record || null);
  }, [activeData]);

  const onDragEnd = React.useCallback(async (result) => {
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

      // Update via API
      await apiClient.updateScheduleRecord(selectedWeek, updatedRecord);
      if (typeof refreshData === 'function') await refreshData();
    } catch (e) {
      alert("Erro ao mover aula: " + e.message);
      // Rollback on Error
      if (typeof refreshData === 'function') await refreshData();
    }
  }, [activeData, checkConflict, selectedWeek, refreshData]);


  const getFormattedDayLabel = (dayName) => {
    if (scheduleMode === 'padrao') return dayName.split('-')[0].toUpperCase();
    if (!selectedWeek || !academicWeeks) return dayName.split('-')[0].toUpperCase();
    const wObj = academicWeeks.find(w => String(w.id) === String(selectedWeek));
    if (!wObj || !wObj.start_date) return dayName.split('-')[0].toUpperCase();
    
    const parts = wObj.start_date.split('-');
    if (parts.length !== 3) return dayName.split('-')[0].toUpperCase();
    
    const baseDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
    const baseDayIndex = baseDate.getDay(); 
    
    const targetDayIndex = parseInt(Object.keys(MAP_DAYS).find(k => MAP_DAYS[k] === dayName));
    if (isNaN(targetDayIndex)) return dayName.split('-')[0].toUpperCase();
    
    const diff = targetDayIndex - baseDayIndex; 
    const targetDate = new Date(baseDate);
    targetDate.setDate(targetDate.getDate() + diff);
    
    const dayFmt = String(targetDate.getDate()).padStart(2, '0');
    const monthFmt = String(targetDate.getMonth() + 1).padStart(2, '0');
    return `${dayName.split('-')[0].toUpperCase()} ${dayFmt}/${monthFmt}`;
  };



  React.useEffect(() => {
    if (viewMode === 'hoje' && scheduleMode !== 'padrao' && selectedWeek && academicWeeks) {
      const wObj = academicWeeks.find(w => String(w.id) === String(selectedWeek));
      if (wObj && wObj.start_date) {
         const parts = wObj.start_date.split('-');
         if (parts.length === 3) {
            const weekStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0);
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
    }
  }, [selectedWeek, viewMode, scheduleMode, academicWeeks]);

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
    if (!['admin', 'gestao'].includes(String(userRole || '').toLowerCase())) {
      setDbCourses([]);
      setDbClasses([]);
      return;
    }
    Promise.all([
      apiClient.fetchCurriculum('matrix'),
      apiClient.fetchCurriculum('class')
    ]).then(([crs, cls]) => {
      setDbCourses(crs || []);
      setDbClasses(cls || []);
    }).catch(e => console.error("Falha ao carregar dicionários", e));
  }, [userRole]);

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
               classId: s.classId,
               day: isNaN(s.dayOfWeek) ? String(s.dayOfWeek) : String(MAP_DAYS[s.dayOfWeek]),
               time: s.slotId,
               subject: discName,
               disciplineId: s.disciplineId,
               teacher: s.teacherId ? String(s.teacherId).split(',').map(id => resolveTeacherName(id, globalTeachers)).join(',') : 'A Definir',
               teacherId: s.teacherId || '',
               room: s.room || '',
               ...extraRecs,
               raw: s
           };
       });
   }, [horariosFiltrados, dbClasses, dbCourses, disciplinesMeta, subjectHoursMeta, globalTeachers, matrixDisciplinesMap]);

   const lastAutoSelectContext = React.useRef({ week: null, role: null });

   React.useEffect(() => {
     if (!mappedSchedules || mappedSchedules.length === 0) return;
     if (lastAutoSelectContext.current.week === selectedWeek && lastAutoSelectContext.current.role === appMode) return;
     
     lastAutoSelectContext.current = { week: selectedWeek, role: appMode };
     
     const todayIndex = new Date().getDay();
     const nameOfToday = MAP_DAYS[todayIndex] || 'Segunda-feira';
     
     if (nameOfToday === 'Sábado' || nameOfToday === 'Domingo') {
         const hasSaturday = mappedSchedules.some(s => s.day === 'Sábado');
         if (nameOfToday === 'Sábado' && hasSaturday) {
             setSelectedDay('Sábado');
         } else {
             setSelectedDay('Segunda-feira');
         }
     } else {
         if (safeDays.includes(nameOfToday)) {
             setSelectedDay(nameOfToday);
         } else {
             setSelectedDay('Segunda-feira');
         }
     }
   }, [mappedSchedules, selectedWeek, appMode, safeDays, setSelectedDay]);

   const dynamicCoursesList = React.useMemo(() => {
     return ['Todos', ...[...new Set(dbCourses.map(c => c.course))].filter(Boolean).sort((a,b) => a.localeCompare(b))];
   }, [dbCourses]);

   const dynamicClassesList = React.useMemo(() => {
     return [...new Set(dbClasses.map(c => c.name))].filter(Boolean).sort((a,b) => a.localeCompare(b));
   }, [dbClasses]);

   const filteredCourseClasses = React.useMemo(() => {
     let classes = dynamicClassesList;
     if (appMode === 'professor') {
       if (scheduleMode === 'padrao' && padraoFilterTeacher && padraoFilterTeacher !== 'Todos') {
         const teacherSchedules = schedules.filter(s => s.teacherId && String(s.teacherId).includes(String(padraoFilterTeacher)));
         const classNames = new Set(teacherSchedules.map(s => {
            const classObj = dbClasses.find(c => String(c.id) === String(s.classId));
            return classObj ? classObj.name : s.className;
         }));
         classes = classes.filter(name => classNames.has(name));
       } else if (showOnlyMyClasses && siape) {
         const mySchedules = schedules.filter(s => s.teacherId && String(s.teacherId).includes(String(siape)));
         const myClassNames = new Set(mySchedules.map(s => {
            const classObj = dbClasses.find(c => String(c.id) === String(s.classId));
            return classObj ? classObj.name : s.className;
         }));
         classes = classes.filter(name => myClassNames.has(name));
       }
     }
     return classes;
   }, [dynamicClassesList, appMode, scheduleMode, padraoFilterTeacher, showOnlyMyClasses, schedules, siape, dbClasses]);

    const filteredClassesList = React.useMemo(() => {
      let lists = dynamicClassesList;
      if (selectedCourse && selectedCourse !== 'Todos' && selectedCourse !== '') {
        const courseObjs = dbCourses.filter(c => c.course === selectedCourse);
        if (courseObjs.length > 0) {
          const validMatrixIds = courseObjs.map(c => String(c.id));
          lists = dbClasses
            .filter(c => validMatrixIds.includes(String(c.matrixId)))
            .map(c => c.name)
            .filter(Boolean)
            .sort((a,b) => a.localeCompare(b));
        }
      }
      
      if (appMode === 'professor' && showOnlyMyClasses && siape) {
        const mySchedules = schedules.filter(s => s.teacherId && String(s.teacherId).includes(String(siape)));
        const myClassNames = new Set(mySchedules.map(s => {
           const classObj = dbClasses.find(c => String(c.id) === String(s.classId));
           return classObj ? classObj.name : s.className;
        }));
        lists = lists.filter(name => myClassNames.has(name));
      }

      return lists.length > 0 ? lists : dynamicClassesList;
    }, [selectedCourse, dbClasses, dbCourses, dynamicClassesList, appMode, showOnlyMyClasses, schedules, siape]);

   const dynamicWeeksList = React.useMemo(() => {
     if (!schedules || !Array.isArray(schedules) || !academicWeeks) return [];
     
     const now = new Date();
     now.setHours(0,0,0,0);
     const sortedWeeks = [...academicWeeks].sort((a,b) => new Date(a.start_date) - new Date(b.start_date));

     let modeSchedules = [];
     if (scheduleMode === 'consolidado') {
        modeSchedules = schedules.filter(s => s.type === 'oficial' && String(s.academic_year) === String(selectedConfigYear));
     } else if (scheduleMode === 'atual') {
        modeSchedules = schedules.filter(s => s.type === 'atual' && String(s.academic_year) === String(selectedConfigYear));
     } else if (scheduleMode === 'previa') {
        modeSchedules = schedules.filter(s => s.type === 'previa' && String(s.academic_year) === String(selectedConfigYear));
     } else if (scheduleMode === 'padrao') {
        modeSchedules = schedules.filter(s => s.type === 'padrao' && String(s.academic_year) === String(selectedConfigYear));
     } else {
        modeSchedules = schedules.filter(s => s.type === scheduleMode && String(s.academic_year) === String(selectedConfigYear));
     }

     if (scheduleMode === 'padrao') {
        const versions = [...new Set(modeSchedules.map(s => String(s.week_id)))].filter(v => typeof v === 'string' && v.startsWith('V'));
        if (versions.length === 0) return [{ value: 'V1', label: 'Versão 1 (V1)' }];
        return versions.sort((a,b) => (parseInt(a.replace('V',''))||0) - (parseInt(b.replace('V',''))||0)).map(v => ({ value: v, label: `Versão ${v.replace('V', '')} (${v})` }));
     }

     let uniqueWeekIds = [...new Set(modeSchedules.map(s => String(s.week_id)))].filter(Boolean);

     uniqueWeekIds = uniqueWeekIds.filter(id => {
        const w = academicWeeks.find(week => String(week.id) === String(id));
        if (!w) return false;
        const s = new Date(w.start_date + 'T00:00:00');
        const e = new Date(w.end_date + 'T23:59:59');
        
        // Ajuste inteligente: no sábado e domingo, avançamos "now" virtualmente para segunda para que a semana que vai começar já conste como 'atual'
        const shiftedNow = new Date(now);
        if (shiftedNow.getDay() === 6) shiftedNow.setDate(shiftedNow.getDate() + 2);
        else if (shiftedNow.getDay() === 0) shiftedNow.setDate(shiftedNow.getDate() + 1);

        const isPast = e < now; 
        const isCurrent = shiftedNow >= s && shiftedNow <= e;
        const isFuture = s > shiftedNow;
        
        if (scheduleMode === 'consolidado') return isPast;
        if (scheduleMode === 'atual') return isCurrent;
        if (scheduleMode === 'previa') return isFuture;
        return true;
     });

     // Regra Aluno Prévia Estrita: Apenas exibir prévia na exata Próxima Semana letiva
     if (appMode === 'aluno' && scheduleMode === 'previa') {
         const refDate = new Date(now);
         if (now.getDay() === 6) refDate.setDate(refDate.getDate() + 2);
         else if (now.getDay() === 0) refDate.setDate(refDate.getDate() + 1);
         refDate.setHours(0,0,0,0);
         
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
     }).sort((a,b) => {
        if (scheduleMode === 'consolidado') return b.label.localeCompare(a.label);
        return a.label.localeCompare(b.label);
     });
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
     if (!selectedClass && filteredClassesList.length > 0 && typeof setSelectedClass === 'function') {
         setSelectedClass(filteredClassesList[0]);
     }
   }, [filteredClassesList, selectedClass, setSelectedClass]);

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

           if (mode === 'atual' || mode === 'oficial') {
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
           handleAlunoScheduleTab('atual'); 
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
        {/* LINKS RÁPIDOS E FERRAMENTAS - SEMPRE VISÍVEL PARA PROFESSOR LOGADO NO TOPO */}
        {appMode === 'professor' && !selectedColleague && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-10 no-print animate-in duration-1000 slide-in-from-top-4">
            
            {/* SEI */}
            <a href="https://sip.ifro.edu.br/sip/login.php?sigla_orgao_sistema=IFRO&sigla_sistema=SEI&infra_url=L3NlaS8=" target="_blank" rel="noopener noreferrer" 
               className={`group relative flex items-center gap-4 p-4 rounded-3xl border transition-all duration-500 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/80 hover:scale-[1.02] hover:shadow-2xl shadow-indigo-900/10' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:scale-[1.02]'}`}>
               <div className={`p-3 rounded-2xl transition-all duration-500 ${isDarkMode ? 'bg-indigo-950 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(79,70,229,0.4)]' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(79,70,229,0.2)]'}`}>
                  <FileText size={20} className="transition-transform duration-500 group-hover:rotate-12" />
               </div>
               <div className="flex flex-col">
                 <h4 className={`text-[10px] font-black uppercase tracking-widest leading-none ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>Acesso ao SEI</h4>
                 <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tighter opacity-80">Documentos</p>
               </div>
               <div className="absolute -bottom-3 -right-3 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-110 transition-all duration-700 pointer-events-none">
                  <FileText size={70} />
               </div>
            </a>

            {/* MEUS DIÁRIOS (SUAP) */}
            <a href="https://suap.ifro.edu.br/edu/meus_diarios/" target="_blank" rel="noopener noreferrer" 
               className={`group relative flex items-center gap-4 p-4 rounded-3xl border transition-all duration-500 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/80 hover:scale-[1.02] hover:shadow-2xl shadow-emerald-900/10' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:scale-[1.02]'}`}>
               <div className={`p-3 rounded-2xl transition-all duration-500 ${isDarkMode ? 'bg-emerald-950 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]'}`}>
                  <BookOpen size={20} className="transition-transform duration-500 group-hover:-rotate-12" />
               </div>
               <div className="flex flex-col">
                 <h4 className={`text-[10px] font-black uppercase tracking-widest leading-none ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>Meus Diários</h4>
                 <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tighter opacity-80">SUAP Diários</p>
               </div>
               <div className="absolute -bottom-3 -right-3 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-110 transition-all duration-700 pointer-events-none">
                  <BookOpen size={70} />
               </div>
            </a>

            {/* GMAIL */}
            <a href="https://mail.google.com/" target="_blank" rel="noopener noreferrer" 
               className={`group relative flex items-center gap-4 p-4 rounded-3xl border transition-all duration-500 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-rose-900/20 hover:scale-[1.02] hover:shadow-2xl shadow-rose-900/10' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:scale-[1.02]'}`}>
               <div className={`p-3 rounded-2xl transition-all duration-500 ${isDarkMode ? 'bg-rose-950 text-rose-400 group-hover:bg-rose-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(225,29,72,0.4)]' : 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(225,29,72,0.2)]'}`}>
                  <Mail size={20} className="transition-transform duration-500 group-hover:scale-110" />
               </div>
               <div className="flex flex-col">
                 <h4 className={`text-[10px] font-black uppercase tracking-widest leading-none ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>Gmail IFRO</h4>
                 <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tighter opacity-80">E-mail Institucional</p>
               </div>
               <div className="absolute -bottom-3 -right-3 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-110 transition-all duration-700 pointer-events-none">
                  <Mail size={70} />
               </div>
            </a>

            {/* WHATSAPP DAPE */}
            <a href="https://wa.me/556921836926" target="_blank" rel="noopener noreferrer" 
               className={`group relative flex items-center gap-4 p-4 rounded-3xl border transition-all duration-500 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-green-900/20 hover:scale-[1.02] hover:shadow-2xl shadow-green-900/10' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:scale-[1.02]'}`}>
               <div className={`p-3 rounded-2xl transition-all duration-500 ${isDarkMode ? 'bg-green-950 text-green-400 group-hover:bg-green-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(22,163,74,0.4)]' : 'bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(22,163,74,0.2)]'}`}>
                  <MessageCircle size={20} className="transition-transform duration-500 group-hover:rotate-6" />
               </div>
               <div className="flex flex-col">
                 <h4 className={`text-[10px] font-black uppercase tracking-widest leading-none ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>WhatsApp DAPE</h4>
                 <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tighter opacity-80">(69) 2183-6926</p>
               </div>
               <div className="absolute -bottom-3 -right-3 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-110 transition-all duration-700 pointer-events-none">
                  <MessageCircle size={70} />
               </div>
            </a>

            {/* AGENDAR SALAS */}
            <a href="https://suap.ifro.edu.br/admin/comum/sala/?agendavel__exact=1&all=&predio__uo=7&tab=tab_any_data" target="_blank" rel="noopener noreferrer" 
               className={`group relative flex items-center gap-4 p-4 rounded-3xl border transition-all duration-500 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/80 hover:scale-[1.02] hover:shadow-2xl shadow-blue-900/10' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:scale-[1.02]'}`}>
               <div className={`p-3 rounded-2xl transition-all duration-500 ${isDarkMode ? 'bg-blue-950 text-blue-400 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(37,99,235,0.2)]'}`}>
                  <MapPin size={20} className="transition-transform duration-500 group-hover:translate-y-[-2px]" />
               </div>
               <div className="flex flex-col">
                 <h4 className={`text-[10px] font-black uppercase tracking-widest leading-none ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>Agendar Salas</h4>
                 <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tighter opacity-80">Ambientes SUAP</p>
               </div>
               <div className="absolute -bottom-3 -right-3 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-110 transition-all duration-700 pointer-events-none">
                  <MapPin size={70} />
               </div>
            </a>

            {/* LABORATORIOS */}
            <a href="https://docs.google.com/spreadsheets/d/1k9Tyy_2pYsJyRKeSq3NpSpXHzUoPigyweyRUHGiAbW4/edit?gid=176889928#gid=176889928" target="_blank" rel="noopener noreferrer" 
               className={`group relative flex items-center gap-4 p-4 rounded-3xl border transition-all duration-500 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/80 hover:scale-[1.02] hover:shadow-2xl shadow-amber-900/10' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:scale-[1.02]'}`}>
               <div className={`p-3 rounded-2xl transition-all duration-500 ${isDarkMode ? 'bg-amber-950 text-amber-400 group-hover:bg-amber-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(217,119,6,0.4)]' : 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(217,119,6,0.2)]'}`}>
                  <Monitor size={20} className="transition-transform duration-500 group-hover:scale-110" />
               </div>
               <div className="flex flex-col">
                 <h4 className={`text-[10px] font-black uppercase tracking-widest leading-none ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>Laboratórios</h4>
                 <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tighter opacity-80">Reserva de Labs</p>
               </div>
               <div className="absolute -bottom-3 -right-3 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-110 transition-all duration-700 pointer-events-none">
                  <Monitor size={70} />
               </div>
            </a>
          </div>
        )}

        {/* DASHBOARD HEADER: LINKS ALUNO (UX PREMIUM - MOBILE OPTIMIZED) */}
        {appMode === 'aluno' && (
          <div className="flex flex-row overflow-x-auto lg:grid lg:grid-cols-3 gap-4 mb-8 no-print animate-in duration-1000 slide-in-from-top-4 pb-2 scrollbar-hide">
            
            {/* AVA IFRO */}
            <a href="https://virtual.ifro.edu.br/jiparana/" target="_blank" rel="noopener noreferrer" 
               className={`flex-none w-[140px] sm:w-auto group relative flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-4 p-4 rounded-2xl border transition-all duration-500 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/80 hover:scale-[1.02] hover:shadow-2xl shadow-indigo-900/10' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:scale-[1.02]'}`}>
               <div className={`p-2.5 rounded-xl transition-all duration-500 ${isDarkMode ? 'bg-indigo-950 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(79,70,229,0.4)]' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(79,70,229,0.2)]'}`}>
                  <BookOpen size={18} className="transition-transform duration-500 group-hover:-rotate-12" />
               </div>
               <div className="flex flex-col text-center sm:text-left">
                 <h4 className={`text-[10px] font-black uppercase tracking-widest leading-none ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>AVA IFRO</h4>
                 <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tighter opacity-80 hidden sm:block">Virtual</p>
               </div>
               <div className="absolute -bottom-2 -right-2 opacity-[0.03] group-hover:opacity-[0.06] group-hover:scale-110 transition-all duration-700 pointer-events-none">
                  <BookOpen size={60} />
               </div>
            </a>

            {/* SUAP ALUNO */}
            <a href="https://suap.ifro.edu.br/" target="_blank" rel="noopener noreferrer" 
               className={`flex-none w-[140px] sm:w-auto group relative flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-4 p-4 rounded-2xl border transition-all duration-500 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/80 hover:scale-[1.02] hover:shadow-2xl shadow-emerald-900/10' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:scale-[1.02]'}`}>
               <div className={`p-2.5 rounded-xl transition-all duration-500 ${isDarkMode ? 'bg-emerald-950 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]'}`}>
                  <Users size={18} className="transition-transform duration-500 group-hover:scale-110" />
               </div>
               <div className="flex flex-col text-center sm:text-left">
                 <h4 className={`text-[10px] font-black uppercase tracking-widest leading-none ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>Portal SUAP</h4>
                 <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tighter opacity-80 hidden sm:block">Notas</p>
               </div>
               <div className="absolute -bottom-2 -right-2 opacity-[0.03] group-hover:opacity-[0.06] group-hover:scale-110 transition-all duration-700 pointer-events-none">
                  <Users size={60} />
               </div>
            </a>

            {/* WHATSAPP CAED */}
            <a href="https://wa.me/5569999047804" target="_blank" rel="noopener noreferrer" 
               className={`flex-none w-[140px] sm:w-auto group relative flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-4 p-4 rounded-2xl border transition-all duration-500 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-green-900/20 hover:scale-[1.02] hover:shadow-2xl shadow-green-900/10' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:scale-[1.02]'}`}>
               <div className={`p-2.5 rounded-xl transition-all duration-500 ${isDarkMode ? 'bg-green-950 text-green-400 group-hover:bg-green-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(22,163,74,0.4)]' : 'bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(22,163,74,0.2)]'}`}>
                  <MessageCircle size={18} className="transition-transform duration-500 group-hover:rotate-6" />
               </div>
               <div className="flex flex-col text-center sm:text-left">
                 <h4 className={`text-[10px] font-black uppercase tracking-widest leading-none ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>WhatsApp</h4>
                 <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tighter opacity-80 hidden sm:block">CAED</p>
               </div>
               <div className="absolute -bottom-2 -right-2 opacity-[0.03] group-hover:opacity-[0.06] group-hover:scale-110 transition-all duration-700 pointer-events-none">
                  <MessageCircle size={60} />
               </div>
            </a>
          </div>
        )}

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
            <div className={`rounded-2xl shadow-sm border p-4 space-y-4 no-print print:hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              
              {/* Nível 1: Tipos de Visão (Adaptável por Perfil) */}
              <div className={`flex items-center justify-between border-b pb-3 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                <div className={`flex flex-wrap items-center gap-2 p-1.5 rounded-xl shadow-inner w-full ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
                  
                  {appMode === 'professor' && (
                    <>
                      <button onClick={() => { setViewMode('professor'); if(['servidor', 'admin', 'gestao'].includes(userRole) && typeof setSelectedTeacher === 'function') setSelectedTeacher(siape); setSelectedColleague(''); }} 
                              className={"flex flex-1 sm:flex-none min-w-[130px] items-center justify-center gap-2 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all " + (viewMode === 'professor' && !selectedColleague ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-400/50' : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700' : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900'))}>
                        <UserCircle size={14} /> Meu Horário
                      </button>

                      <button onClick={() => setViewMode('curso')} 
                              className={"flex flex-1 sm:flex-none min-w-[130px] items-center justify-center gap-2 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all " + (viewMode === 'curso' ? 'bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-400/50' : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700' : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900'))}>
                        <Layers size={14} /> Permutas e Reposições
                      </button>

                      <button onClick={() => setViewMode('solicitacoes')} 
                              className={"flex flex-1 sm:flex-none min-w-[130px] items-center justify-center gap-2 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all " + (viewMode === 'solicitacoes' ? 'bg-amber-500 text-white shadow-lg ring-2 ring-amber-400/50' : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700' : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900'))}>
                        <Bell size={14} /> Solicitações
                      </button>
                      
                      <button onClick={() => setViewMode('total')} 
                              className={"flex flex-1 sm:flex-none min-w-[130px] items-center justify-center gap-2 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all " + (viewMode === 'total' ? 'bg-orange-600 text-white shadow-lg ring-2 ring-orange-400/50' : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700' : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900'))}>
                        <BarChart3 size={14} /> Controle de Aulas
                      </button>

                    </>
                  )}

                  {appMode === 'aluno' && (
                    <>
                      {/* Destaques Aluno */}
                      <button onClick={() => { setViewMode('hoje'); if (scheduleMode === 'oficial') handleAlunoScheduleTab('atual'); }} 
                              className={`flex-1 sm:flex-none min-w-[130px] flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'hoje' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 ring-2 ring-blue-400/50' : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200')}`}>
                        <ListTodo size={14} /> Painel Diário
                      </button>
                      <button onClick={() => { setViewMode('turma'); if (scheduleMode === 'oficial') handleAlunoScheduleTab('atual'); }} 
                              className={`flex-1 sm:flex-none min-w-[130px] flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'turma' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 ring-2 ring-emerald-400/50' : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200')}`}>
                        <Calendar size={14} /> Minha Turma
                      </button>
                      <button onClick={() => setViewMode('professor')} 
                              className={`flex-1 sm:flex-none min-w-[130px] flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'professor' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 ring-2 ring-indigo-400/50' : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200')}`}>
                        <UserCircle size={14} /> Professor
                      </button>
                      <button onClick={() => { setViewMode('historico'); setScheduleMode('oficial'); }} 
                              className={`flex-1 sm:flex-none min-w-[130px] flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'historico' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/40 ring-2 ring-orange-400/50' : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200')}`}>
                        <Clock size={14} /> Aulas Passadas
                      </button>
                    </>
                  )}
                  
                </div>
              </div>

              {viewMode !== 'solicitacoes' && (
                <React.Fragment>
              {/* Filtros Específicos para renderização */}
              {viewMode !== 'curso' && viewMode !== 'sem_professor' && (
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 rounded-xl border no-print ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                  {(['turma', 'hoje', 'historico'].includes(viewMode)) && (
                    <>
                      <div className="space-y-1 lg:col-span-2"><label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1 block">Filtrar por Curso</label>
                        <SearchableSelect isDarkMode={isDarkMode} options={dynamicCoursesList} value={selectedCourse} onChange={setSelectedCourse} colorClass={isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-sm' : 'bg-white border-slate-200 text-slate-700 shadow-sm'} />
                      </div>
                      <div className="space-y-1 lg:col-span-2">
                        {appMode === 'professor' ? (
                          <div className="flex items-center justify-between">
                            <label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1">Visualizar Turma</label>
                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 px-2 py-0.5 rounded transition-colors group">
                                <input type="checkbox" checked={showOnlyMyClasses} onChange={e => setShowOnlyMyClasses(e.target.checked)} className="peer sr-only" />
                                <div className={`w-3 h-3 rounded-sm border flex items-center justify-center transition-colors ${showOnlyMyClasses ? 'bg-indigo-500 border-indigo-500' : 'bg-transparent border-slate-300 dark:border-slate-600 group-hover:border-indigo-400'} ${isDarkMode ? 'peer-focus:ring-indigo-800' : 'peer-focus:ring-indigo-200'}`}>
                                  {showOnlyMyClasses && <Check size={8} className="text-white" />}
                                </div>
                                <span className={`text-[8px] font-black tracking-widest uppercase transition-colors ${showOnlyMyClasses ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>Apenas Minhas Turmas</span>
                            </label>
                          </div>
                        ) : (
                          <label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1 block">Visualizar Turma</label>
                        )}
                        <SearchableSelect isDarkMode={isDarkMode} options={filteredClassesList} value={selectedClass} onChange={setSelectedClass} colorClass={scheduleMode === 'previa' ? (isDarkMode ? "bg-violet-900/30 border-violet-800/50 text-violet-200 shadow-sm" : "bg-violet-50 border-violet-100 text-violet-900 shadow-sm") : viewMode === 'hoje' ? (isDarkMode ? "bg-blue-900/30 border-blue-800/50 text-blue-200 shadow-sm" : "bg-blue-50 border-blue-100 text-blue-900 shadow-sm") : (isDarkMode ? "bg-emerald-900/30 border-emerald-800/50 text-emerald-200 shadow-sm" : "bg-emerald-50 border-emerald-100 text-emerald-900 shadow-sm")} />
                      </div>
                    </>
                  )}
                  {((viewMode === 'professor' && appMode === 'aluno') || viewMode === 'outro_professor') && (
                    <div className="space-y-1 col-span-full md:col-span-2">
                       {/* Mantido funcional para aluno ou modo legado que precise */}
                      <label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1 block">
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
                  )}


                  {viewMode === 'total' && (
                    <>
                      <div className="space-y-1"><label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1 block">Ano Letivo</label>
                        <SearchableSelect isDarkMode={isDarkMode} options={availableYearsForTotal} value={totalFilterYear} onChange={setTotalFilterYear} colorClass={isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-sm' : 'bg-white border-slate-200 text-slate-800 shadow-sm'} />
                      </div>
                      <div className="space-y-1"><label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1 block">Professor</label>
                        <SearchableSelect isDarkMode={isDarkMode} options={availableTeachersForTotal.map(t => ({value: t, label: resolveTeacherName(t, globalTeachers)}))} value={totalFilterTeacher} onChange={setTotalFilterTeacher} colorClass={isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-sm' : 'bg-white border-slate-200 text-slate-800 shadow-sm'} />
                      </div>
                      <div className="space-y-1"><label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1 block">Turma</label>
                        <SearchableSelect isDarkMode={isDarkMode} options={availableClassesForTotal} value={totalFilterClass} onChange={setTotalFilterClass} colorClass={isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-sm' : 'bg-white border-slate-200 text-slate-800 shadow-sm'} />
                      </div>
                      <div className="space-y-1"><label className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase ml-1 block">Disciplina</label>
                        <SearchableSelect 
                           isDarkMode={isDarkMode} 
                           options={availableSubjectsForTotal.map(s => ({
                             value: s, 
                             label: s
                           }))} 
                           value={totalFilterSubject} 
                           onChange={setTotalFilterSubject} 
                           colorClass={isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-sm' : 'bg-white border-slate-200 text-slate-800 shadow-sm'} 
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ESTATÍSTICAS - PORTAL DO ALUNO */}
              {appMode === 'aluno' && (['turma', 'hoje', 'historico'].includes(viewMode)) && selectedClass && (
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
            </React.Fragment>
          )}
            </div>

            {viewMode !== 'solicitacoes' && (
              <React.Fragment>
            {/* OPÇÕES DE BASE DE DADOS (Movido para perto da tabela) */}
            {viewMode !== 'total' && (
              <div className={`border p-2.5 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 mb-2 no-print ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`flex border p-1 rounded-xl w-full md:w-auto shrink-0 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  {appMode === 'aluno' ? (
                    <>
                      {viewMode !== 'historico' ? (
                        <>
                          <button onClick={() => handleAlunoScheduleTab('atual')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scheduleMode === 'atual' ? 'bg-emerald-500 text-white shadow-md' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}`}>
                            <Calendar size={14} /> Horário Atual 
                          </button>
                          <button onClick={() => handleAlunoScheduleTab('previa')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scheduleMode === 'previa' ? 'bg-violet-500 text-white shadow-md' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}`}>
                            <Eye size={14} /> Prévia da Próxima
                          </button>
                        </>
                      ) : (
                          <div className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all bg-orange-500 text-white shadow-md cursor-default`}>
                            <Clock size={14} /> Histórico Consolidado
                          </div>
                      )}
                    </>
                  ) : (
                    <>
                      {appMode === 'professor' || appMode === 'gestao' || appMode === 'admin' ? (
                        <>
                          <button onClick={() => setScheduleMode('atual')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scheduleMode === 'atual' ? 'bg-teal-500 text-white shadow-md' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}`}>
                            <Sun size={14} /> Semana Atual
                          </button>
                          <button onClick={() => setScheduleMode('previa')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scheduleMode === 'previa' ? 'bg-violet-500 text-white shadow-md' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}`}>
                            <Eye size={14} /> Prévia (Futuro)
                          </button>
                          <button onClick={() => setScheduleMode('padrao')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scheduleMode === 'padrao' ? 'bg-blue-500 text-white shadow-md' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}`}>
                            <BookOpen size={14} /> Padrão Anual
                          </button>
                          <button onClick={() => setScheduleMode('consolidado')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scheduleMode === 'consolidado' ? 'bg-emerald-500 text-white shadow-md' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}`}>
                            <Calendar size={14} /> Consolidado
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setScheduleMode('consolidado')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scheduleMode === 'consolidado' || scheduleMode === 'oficial' ? 'bg-emerald-500 text-white shadow-md' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}`}>
                          <Calendar size={14} /> Horário Oficial
                        </button>
                      )}
                    </>
                  )}
                </div>

                {(scheduleMode === 'padrao' || appMode !== 'aluno' || viewMode === 'historico') && dynamicWeeksList.length > 0 && (
                    <div className={`p-1 flex items-center gap-2 rounded-lg border cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <CalendarDays size={18} className={`shrink-0 ml-2 opacity-50 ${isDarkMode ? 'text-white' : 'text-slate-700'}`} />
                    <SearchableSelect isDarkMode={isDarkMode} options={dynamicWeeksList} value={selectedWeek} onChange={setSelectedWeek} colorClass={`bg-transparent border-none font-black uppercase tracking-tighter text-[11px] ${isDarkMode ? 'text-white' : 'text-slate-900'}`} placeholder={scheduleMode === 'padrao' ? "A qual semana aplicar?" : "Selecione..."} />
                  </div>
                  )}
              </div>
            )}

            {/* ÁREA ENCAPSULADA DE EXIBIÇÃO E IMPRESSÃO */}
            <div id="printable-area">
              
              {/* TRATAMENTO DE ESTADO VAZIO */}
              {viewMode !== 'total' && (dynamicWeeksList.length === 0 || (scheduleMode !== 'padrao' && horariosFiltrados.length === 0)) ? (
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
                            const getEntityRecords = () => appMode === 'aluno' ? mappedSchedules.filter(r => r.className === selectedClass) : mappedSchedules.filter(r => r.teacherId && r.teacherId.includes(String(siape)));
                            const eShifts = new Set(getEntityRecords().map(r => safeTimes.find(tObj => tObj.timeStr === r.time)?.shift).filter(Boolean));
                            const activeSafeTimes = safeTimes.filter(t => eShifts.has(t.shift));
                            if (activeSafeTimes.length === 0) return <div className="text-[10px] font-bold uppercase tracking-widest text-center py-8 text-slate-400">Não Letivo</div>;
                            return activeSafeTimes.map((timeObj, index) => {
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
                                                   {isPending && (
                                                      <div className="absolute top-0 left-0 z-10 pointer-events-none print:hidden">
                                                         <span className="text-[6px] font-black uppercase tracking-wide text-white px-2 py-0.5 rounded-br-[8px] bg-rose-600 border-r border-b border-rose-700 block animate-pulse shadow-sm shadow-rose-900/30">AULA VAGA</span>
                                                      </div>
                                                   )}
                                                   {r.isSubstituted && (
                                                      <div className="absolute top-0 right-0 z-10 pointer-events-none print:hidden">
                                                          <span title="Assumida no lugar de uma Vaga" className="text-[7px] font-black uppercase tracking-wide text-white px-2 py-0.5 rounded-bl-[8px] bg-indigo-600 border-l border-b border-indigo-700 block animate-pulse shadow-sm shadow-indigo-900/30">Substituição</span>
                                                      </div>
                                                   )}
                                                   {r.classType && r.classType !== 'Regular' && (
                                                      <div className="absolute bottom-0 right-0 z-10 pointer-events-none print:hidden">
                                                          <span className="text-[7px] font-black uppercase tracking-wide text-white px-2 py-0.5 rounded-tl-[8px] bg-emerald-600 border-l border-t border-emerald-700 block shadow-sm shadow-emerald-900/30">{r.classType}</span>
                                                      </div>
                                                   )}
                                                   <div className="pt-2 sm:pt-0">
                                                      <p className={`font-black text-sm leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                                        {r.subject} {r.isSubstituted && r.originalSubject && <span className="block text-[8px] sm:text-[9.5px] opacity-80 mt-1 uppercase">Era: {r.originalSubject}</span>}
                                                      </p>
                                                      <p className={`text-[10px] font-bold uppercase tracking-wider mt-1.5 ${isPending ? (isDarkMode ? 'text-red-400' : 'text-red-600') : 'opacity-80'}`}>{isPending ? 'AULA VAGA' : resolveTeacherName(r.teacher, globalTeachers)}</p>
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
                         <div className="p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                           {(() => {
                              const bimsUI = (bimesters && bimesters.length > 0) ? bimesters.map((b, i) => {
                                const fmtData = (iso) => iso ? iso.split('-').reverse().slice(0,2).join('/') : '';
                                let diasLetivos = 0;
                                const bStart = new Date(b.startDate + 'T00:00:00');
                                const bEnd = new Date(b.endDate + 'T23:59:59');
                                
                                if (academicWeeks) {
                                  academicWeeks.forEach(w => {
                                    const wStart = new Date(w.start_date + 'T12:00:00');
                                    const wEnd = new Date(w.end_date + 'T12:00:00');
                                    if (wStart <= bEnd && wEnd >= bStart) {
                                      const overlapStart = new Date(Math.max(wStart.getTime(), bStart.getTime()));
                                      const overlapEnd = new Date(Math.min(wEnd.getTime(), bEnd.getTime()));
                                      let overlapDays = 0;
                                      for (let d = new Date(overlapStart); d <= overlapEnd; d.setDate(d.getDate() + 1)) {
                                          if (d.getDay() !== 0) overlapDays++; // Excluindo Domingo
                                      }
                                      
                                      if (wStart >= bStart && wEnd <= bEnd && w.school_days > 0) {
                                          diasLetivos += w.school_days;
                                      } else if (w.school_days > 0) {
                                          diasLetivos += Math.min(overlapDays, w.school_days);
                                      } else {
                                          diasLetivos += overlapDays; // Fallback se o DB não tiver os dias letivos preenchidos para a semana
                                      }
                                    }
                                  });
                                }
                                
                                return {
                                  b: i + 1,
                                  name: b.name || `${i + 1}º Bimestre`,
                                  d: fmtData(b.startDate) + ' a ' + fmtData(b.endDate),
                                  start: fmtData(b.startDate),
                                  diasLetivos
                                };
                              }) : [
                                {b:1, name:'1º Bimestre', start: "04/02", diasLetivos: 0},
                                {b:2, name:'2º Bimestre', start: "22/04", diasLetivos: 0},
                                {b:3, name:'3º Bimestre', start: "22/07", diasLetivos: 0},
                                {b:4, name:'4º Bimestre', start: "29/09", diasLetivos: 0}
                              ];
                              
                              // Preenche o resto até dar 4
                              while (bimsUI.length < 4) bimsUI.push({ b: bimsUI.length + 1, name: `${bimsUI.length + 1}º Bimestre`, start: "-", diasLetivos: 0 });
                              
                              return bimsUI.slice(0,4).map(bim => (
                                <div key={bim.b} className={`rounded-xl border shadow-sm print:break-inside-avoid flex flex-col ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                  <div className={`p-4 border-b flex flex-col gap-3 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                                    <div>
                                      <h4 className={`font-black text-sm uppercase tracking-wider ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>{bim.name}</h4>
                                      <p className="text-[10px] uppercase tracking-widest mt-1 opacity-70">
                                        Início: <b className="text-emerald-500 mr-2">{bim.start}</b> | 
                                        Dias Letivos: <b className="text-emerald-500">{bim.diasLetivos}</b>
                                      </p>
                                    </div>
                                    <div className={`text-white px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-widest shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-indigo-600' : 'bg-indigo-600'}`}>
                                      <span className="text-[8px] opacity-80">Aulas Contabilizadas</span>
                                      <span className="text-sm">{String((bimestresData[bim.b] || []).length).padStart(2, '0')}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="p-2 md:p-3 flex flex-col gap-1 flex-1">
                                    {(bimestresData[bim.b] && bimestresData[bim.b].length > 0) ? bimestresData[bim.b].map(r => (
                                        <div key={r.id} className={`text-[10px] font-semibold py-1 border-b border-slate-500/10 last:border-0 hover:bg-slate-500/5 px-1 rounded transition-colors ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                           {r.date} - {r.time.replace(' - ', ' ')} - <span className="uppercase">{r.subject}</span> {r.className && <span className="opacity-60 ml-1">({r.className})</span>}
                                        </div>
                                    )) : (
                                        <div className="col-span-full text-center py-8 opacity-40 flex flex-col items-center justify-center gap-2 select-none no-print">
                                          <Calendar size={24} />
                                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sem Aulas Registradas Neste Bimestre</span>
                                        </div>
                                    )}
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      </div>
                  )}

                  {/* GRADE DE HORÁRIO (Visão Curso MATRIZ) */}
                  {viewMode === 'curso' && (
                    <div className="flex flex-col gap-4 animate-in zoom-in-95 duration-500">

                      
                      <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
                        <div className="flex flex-col lg:flex-row gap-4">
                          <CourseGrid 
                            mappedSchedules={mappedSchedules}
                            isDarkMode={isDarkMode}
                            scheduleMode={scheduleMode}
                            userRole={userRole}
                            globalTeachers={globalTeachers}
                            activeCourseClasses={filteredCourseClasses}
                            safeDays={safeDays}
                            safeTimes={safeTimes}
                            intervals={intervals}
                            dynamicWeeksList={dynamicWeeksList}
                            selectedWeek={selectedWeek}
                            weekLabel={weekLabel}
                            draggingRecord={draggingRecord}
                            checkConflict={checkConflict}
                            setEditorModal={setEditorModal}
                            handlePrint={handlePrint}
                            getColorHash={getColorHash}
                            resolveTeacherName={resolveTeacherName}
                            isTeacherPending={isTeacherPending}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                            profClassesMemo={profClassesMemo}
                            subjectHoursMeta={subjectHoursMeta}
                            activeData={activeData}
                            getFormattedDayLabel={getFormattedDayLabel}
                            appMode={appMode}
                            showOnlyMyClasses={showOnlyMyClasses}
                            setShowOnlyMyClasses={setShowOnlyMyClasses}
                            padraoFilterTeacher={padraoFilterTeacher}
                            setPadraoFilterTeacher={setPadraoFilterTeacher}
                            checkPendingSwapRequest={isSlotInvolvedInPendingRequest}
                            siape={selectedTeacher || siape}
                            onReverseSwapClick={(rec) => {
                               if (rec.teacherId && !String(rec.teacherId).split(',').includes(String(selectedTeacher || siape))) {
                                 if (userRole !== 'admin' && userRole !== 'gestao' && !profClassesMemo.has(rec.className)) {
                                    alert('Você só pode interagir com grades e turmas nas quais você já leciona ao menos uma disciplina.');
                                    return;
                                 }
                                 setPendingReverseTarget(rec);
                               } else if (rec.teacherId && String(rec.teacherId).split(',').includes(String(selectedTeacher || siape))) {
                                  alert('Você não pode propor uma permuta com a sua própria aula.');
                                }
                             }}
                           />
                         </div>
                       </DragDropContext>
                     </div>
                   )}

                   {/* GRADE DE HORÁRIO DO PROFESSOR (Separada por Curso) */}
                   {viewMode === 'professor' && selectedTeacher && (
                       <TeacherGrid 
                         selectedColleague={selectedColleague}
                         showEmptySlots={showEmptySlots}
                         setShowEmptySlots={setShowEmptySlots}
                         onEmptySlotClick={setTeacherDirectModal}
                         onReverseSwapClick={(rec) => {
                            if (rec.teacherId && !String(rec.teacherId).split(',').includes(String(selectedTeacher || siape))) {
                               if (userRole !== 'admin' && userRole !== 'gestao' && !profClassesMemo.has(rec.className)) {
                                  alert('Você só pode interagir com grades e turmas nas quais você já leciona ao menos uma disciplina.');
                                  return;
                               }
                               setPendingReverseTarget(rec);
                            }
                         }}
                         mappedSchedules={mappedSchedules}
                         isDarkMode={isDarkMode}
                         scheduleMode={scheduleMode}
                         appMode={appMode}
                         viewMode={viewMode}
                         userRole={userRole}
                         selectedTeacher={selectedTeacher}
                         globalTeachers={globalTeachers}
                         safeDays={safeDays}
                         safeTimes={safeTimes}
                         dynamicWeeksList={dynamicWeeksList}
                         selectedWeek={selectedWeek}
                         weekLabel={weekLabel}
                         showVacantInMyClasses={showVacantInMyClasses}
                         setShowVacantInMyClasses={setShowVacantInMyClasses}
                         handlePrint={handlePrint}
                         resolveTeacherName={resolveTeacherName}
                         isTeacherPending={isTeacherPending}
                         checkPendingSwapRequest={isSlotInvolvedInPendingRequest}
                         setVacantRequestModal={setVacantRequestModal}
                         setExchangeTarget={(target) => { 
                            setExchangeTarget(target); 
                            setExchangeAction('offer'); 
                         }}
                         getColorHash={getColorHash}
                         getFormattedDayLabel={getFormattedDayLabel}
                         recordsForWeek={recordsForWeek}
                         activeDays={activeDays}
                         classTimes={classTimes}
                       />
                   )}


                  {/* GRADE DE HORÁRIO GERAL (Turma COMPLETA E HISTORICO) */}
                  {['turma', 'historico'].includes(viewMode) && (
                    <ClassGrid
                      mappedSchedules={mappedSchedules}
                      isDarkMode={isDarkMode}
                      scheduleMode={scheduleMode}
                      appMode={appMode}
                      viewMode={viewMode}
                      userRole={userRole}
                      selectedClass={selectedClass}
                      globalTeachers={globalTeachers}
                      safeDays={safeDays}
                      safeTimes={safeTimes}
                      dynamicWeeksList={dynamicWeeksList}
                      selectedWeek={selectedWeek}
                      weekLabel={weekLabel}
                      pendingRequests={pendingRequests}
                      handlePrint={handlePrint}
                      resolveTeacherName={resolveTeacherName}
                      isTeacherPending={isTeacherPending}
                      getColorHash={getColorHash}
                      getFormattedDayLabel={getFormattedDayLabel}
                      onDragEnd={onDragEnd}
                      setEditorModal={setEditorModal}
                      setExchangeTarget={(target) => { 
                         setExchangeTarget(target); 
                         setExchangeAction('offer'); 
                      }}
                    />
                  )}

                  {/* VISTA DE AULAS VAGAS: Separada por Curso */}
                  {viewMode === 'sem_professor' && (
                    <VacantGrid
                      mappedSchedules={mappedSchedules}
                      isDarkMode={isDarkMode}
                      scheduleMode={scheduleMode}
                      selectedWeek={selectedWeek}
                      weekLabel={weekLabel}
                      safeDays={safeDays}
                      safeTimes={safeTimes}
                      dynamicWeeksList={dynamicWeeksList}
                      handlePrint={handlePrint}
                      isTeacherPending={isTeacherPending}
                      getFormattedDayLabel={getFormattedDayLabel}
                    />
                  )}
                </>
              )}
            </div>
            </React.Fragment>
            )}
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
            weekData={{
                id: String(selectedWeek),
                week: String(selectedWeek),
                academic_year: String(selectedConfigYear),
                type: scheduleMode === 'consolidado' ? 'oficial' : scheduleMode,
                records: rawData.filter(r => String(r.week) === String(selectedWeek) && r.type === (scheduleMode === 'consolidado' ? 'oficial' : scheduleMode))
            }} 
            matrixData={[]}
            classesData={classesList || []}
            usersList={globalTeachersList || []}
            classTimes={classTimes}
            userRole={userRole}
            siape={siape}
         />
      )}

      {/* SISTEMA DE SOLICITAÇÕES PARA O PROFESSOR (Apenas Fullscreen, Hub Flutuante movido globalmente para HomeApp) */}
      {appMode === 'professor' && viewMode === 'solicitacoes' && (
        <div className="mt-4 w-full animate-in fade-in slide-in-from-bottom-4">
          <TeacherRequestsSection 
            requests={requests} 
            apiClient={apiClient}
            onCancel={() => {
              if (typeof handleCancelRequest === 'function') handleCancelRequest();
              fetchRequests();
              loadPendingRequests();
            }} 
            isDarkMode={isDarkMode}
            siape={siape}
            selectedWeek={selectedWeek}
            activeDays={activeDays}
            classTimes={classTimes}
            weekData={recordsForWeek ? recordsForWeek.filter(r => String(r.teacherId).includes(String(siape))) : []}
            scheduleMode={scheduleMode}
            isFloating={false}
          />
        </div>
      )}

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
              {Object.values(mappedSchedules.filter(r => r.teacherId && String(r.teacherId).split(',').includes(String(selectedTeacher || siape)) && r.className === vacantRequestModal.className).reduce((acc, curr) => { 
                  if (!acc[curr.subject]) acc[curr.subject] = { id: curr.disciplineId, name: curr.subject };
                  return acc;
              }, {})).map((sub, idx) => (
                <option
                  key={`vacant-subject-${String(sub.id ?? 'sem-id')}-${sub.name}-${idx}`}
                  value={`${sub.id}|${sub.name}`}
                >
                  {sub.name}
                </option>
              ))}
            </select>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setVacantRequestModal(null)} className="flex-1 py-3 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold transition-all hover:bg-slate-300">Cancelar</button>
              <button onClick={() => {
                const subjVal = document.getElementById('vacantSubject').value;
                if (!subjVal) return setAlertModal({ title: 'Atenção', message: 'Selecione a disciplina que deseja lecionar antes de enviar o pedido.', type: 'alert' });
                
                const [discId, subjName] = subjVal.split('|');
                const teachersArray = globalTeachers || globalTeachersList || [];
                const matchedTeacher = teachersArray.find(t => String(t.siape) === String(selectedTeacher || siape));
                const requesterName = matchedTeacher?.nome_exibicao || matchedTeacher?.nome_completo || selectedTeacher || siape;

                apiClient.submitRequest({
                  action: 'vaga',
                  siape: selectedTeacher || siape,
                  week_id: selectedWeek,
                  description: 'Proposta Direta - Solicitação via Grade',
                  original_slot: JSON.stringify({ day: vacantRequestModal.day, time: vacantRequestModal.time, classType: `AULA VAGA na turma ${vacantRequestModal.className}` }),
                  proposed_slot: { day: vacantRequestModal.day, time: vacantRequestModal.time, className: vacantRequestModal.className, classId: vacantRequestModal.classId, subject: subjName, disciplineId: discId, originalSubject: vacantRequestModal.subject, classType: `${subjName} (Mesma turma)`, teacherName: requesterName }
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


      {exchangeTarget && exchangeAction === 'offer' && (
        <TeacherOfferModal 
          isOpen={true} 
          isDarkMode={isDarkMode}
          onClose={() => { setExchangeTarget(null); setExchangeAction(null); }}
          originalRecord={exchangeTarget.originalRecord}
          targetClass={exchangeTarget.targetClass}
          targetCourse={exchangeTarget.targetCourse}
          classRecords={padraoExchangeRecords}
          safeDays={safeDays}
          safeTimes={safeTimes}
          globalTeachers={globalTeachersList}
          apiClient={apiClient}
          selectedWeek={selectedWeek}
          onSubmit={(payload) => {
            apiClient.submitRequest({ ...payload, requester_id: selectedTeacher }).then(() => {
              setAlertModal({ title: 'Tudo Certo!', message: 'Solicitação de disponibilização enviada com sucesso!', type: 'success' });
              fetchRequests();
              setExchangeTarget(null); setExchangeAction(null);
            }).catch(e => {
              setAlertModal({ title: 'Erro', message: e.message || 'Não foi possível enviar a solicitação.', type: 'error' });
            });
          }}
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

      {pendingReverseTarget && (
        <div className="fixed inset-0 z-[200] flex justify-center items-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 no-print">
           <div className={`w-full max-w-lg rounded-3xl shadow-2xl border flex flex-col overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className={`p-5 border-b flex items-center justify-between ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                 <h3 className="font-black uppercase tracking-[0.2em] text-[10px] text-indigo-500">Escolha a Aula para Oferecer em Troca</h3>
                 <button onClick={() => setPendingReverseTarget(null)} className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"><XCircle size={20}/></button>
              </div>
              <div className="p-6 space-y-5">
                 <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-indigo-900/20 border-indigo-800/30 text-indigo-200' : 'bg-indigo-50 border-indigo-100 text-indigo-900'} text-xs relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 p-3 opacity-10"><Calendar size={48} /></div>
                    <p className="font-black uppercase tracking-widest opacity-60 text-[9px] mb-2">AULA ALVO (Colega)</p>
                    <p className="font-bold text-sm tracking-tight">{pendingReverseTarget.subject} - Turma {pendingReverseTarget.className}</p>
                    <p className="font-medium opacity-80 mt-1">{pendingReverseTarget.day} às {pendingReverseTarget.time}</p>
                 </div>

                 <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-3 tracking-widest">Qual aula SUA deseja dar em troca?</label>
                    <select id="reverseSlotSelect" className={`w-full p-4 rounded-2xl border text-xs font-bold outline-none transition-all focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                       <option value="">Selecione uma de suas aulas...</option>
                       {mappedSchedules.filter(r => {
                          const isMyClass = r.teacherId && String(r.teacherId).split(',').includes(String(selectedTeacher || siape));
                          if (!isMyClass) return false;
                          
                          const rTurma = String(r.className || r.classId).toLowerCase().trim();
                          const targetTurma = String(pendingReverseTarget.className || pendingReverseTarget.classId).toLowerCase().trim();
                          if (rTurma !== targetTurma) return false;
                          
                          if (typeof isSlotInvolvedInPendingRequest === 'function' && isSlotInvolvedInPendingRequest(r)) return false;
                          
                          return true;
                       }).map(r => (
                          <option key={r.id} value={r.id}>{r.subject} ({r.className}) - {r.day} {r.time}</option>
                       ))}
                    </select>
                 </div>

                 <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={() => setPendingReverseTarget(null)} className={`px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>Cancelar</button>
                    <button 
                       onClick={() => {
                          const val = document.getElementById('reverseSlotSelect').value;
                          if (!val) return alert('Selecione uma aula!');
                          const selectedClasses = mappedSchedules.filter(r => String(r.id) === String(val));
                          if (selectedClasses.length === 0) return;
                          
                          const originalRecord = selectedClasses[0];
                          const targetRecord = pendingReverseTarget;

                          const payload = {
                             action: 'troca',
                             requester_id: originalRecord.teacherId ? String(originalRecord.teacherId).split(',')[0] : (selectedTeacher || siape),
                             substitute_id: targetRecord.teacherId ? String(targetRecord.teacherId).split(',')[0] : targetRecord.teacher,
                             targetClass: targetRecord.className || targetRecord.classId,
                             week_id: selectedWeek,
                             reason: `Proposta Direta - Solicitação via Grade`,
                             obs: `Troca Direta de ${originalRecord.subject} por ${targetRecord.subject}`,
                             original_slot: { ...originalRecord, classId: originalRecord.classId || originalRecord.className },
                             proposed_slot: {
                                day: targetRecord.day,
                                time: targetRecord.time,
                                subject: targetRecord.subject,
                                teacherId: targetRecord.teacherId || targetRecord.teacher,
                                classId: targetRecord.classId || targetRecord.className,
                                course: targetRecord.course || originalRecord.course,
                                originalSubject: originalRecord.subject
                             }
                          };

                          apiClient.submitRequest(payload).then(() => {
                             alert('Solicitação de troca enviada com sucesso!');
                             setPendingReverseTarget(null);
                             refreshData();
                             fetchRequests();
                          }).catch(err => {
                             alert('Erro ao enviar solicitação: ' + err.message);
                          });
                       }}
                       className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_10px_20px_-5px_rgba(79,70,229,0.4)] active:scale-95 transition-all"
                    >
                       Confirmar Proposta
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      <TeacherDirectModal 
        isOpen={!!teacherDirectModal}
        slotData={teacherDirectModal}
        onClose={() => setTeacherDirectModal(null)}
        onSuccess={() => { refreshData(); setTeacherDirectModal(null); }}
        siape={selectedColleague || siape}
        selectedWeek={selectedWeek}
        isDarkMode={isDarkMode}
        dbClasses={classesList}
        scheduleMode={scheduleMode}
      />
    </>
  );
}
