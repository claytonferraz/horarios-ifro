import React, { useState, useTransition } from 'react';
import { 
  Calendar, UserCircle, Layers, AlertTriangle, BarChart3, ListTodo, CalendarDays, Settings, Bell, Sun, RefreshCcw, HandHeart, X, ExternalLink, Scissors, MapPin, Monitor, Mail, MessageCircle, Activity,
  BookOpen, FileText, Users, CheckCircle, AlertCircle, XCircle, Eye, Clock, Check, Printer, Home, Globe, Book, Shuffle, ClipboardList, Search, LayoutDashboard, MessageSquare
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
import { AdminTotalControl } from '../ui/admin/AdminTotalControl';
import { CommandCenterDashboard } from '../ui/admin/CommandCenterDashboard';

const PENDING_REQUEST_STATUSES = new Set([
  'pendente',
  'pending',
  'aguardando_colega',
  'pronto_para_homologacao',
]);

export function PortalView({
  appMode, isDarkMode, isDim, viewMode, setViewMode, scheduleMode, setScheduleMode, userRole, siape,
  selectedCourse, setSelectedCourse, selectedClass, setSelectedClass, selectedTeacher, setSelectedTeacher,
  totalFilterYear, setTotalFilterYear, totalFilterTeacher, setTotalFilterTeacher, totalFilterClass, setTotalFilterClass, totalFilterSubject, setTotalFilterSubject,
  courses, classesList, globalTeachersList, availableYearsForTotal, availableTeachersForTotal, availableClassesForTotal, availableSubjectsForTotal,
  alunoStats, diarioStats, finalFilteredTotalData, bimestresData, recordsForWeek,
  activeData, handlePrint, getColorHash, isTeacherPending,
  selectedDay, setSelectedDay, selectedWeek, setSelectedWeek, activeWeeksList,
  getCellRecords, activeCourseClasses, profStats, activeDays, classTimes, rawData, loadAdminMetadata
}) {
  const { globalTeachers, refreshData, subjectHoursMeta, intervals, selectedConfigYear, disciplinesMeta, schedules, academicWeeks, bimesters } = useData();
  const [isPending, startTransition] = useTransition();

  // Constantes de mapeamento de dias (Escopo estável)
  const dayFullLabels = React.useMemo(() => ({ 'seg': 'Segunda', 'ter': 'Terça', 'qua': 'Quarta', 'qui': 'Quinta', 'sex': 'Sexta', 'sab': 'Sábado', 'dom': 'Domingo' }), []);
  const dayOrder = React.useMemo(() => ({ 'seg': 1, 'ter': 2, 'qua': 3, 'qui': 4, 'sex': 5, 'sab': 6, 'dom': 7 }), []);
  const shortDayMap = React.useMemo(() => ({ 'Segunda-feira': 'seg', 'Terça-feira': 'ter', 'Quarta-feira': 'qua', 'Quinta-feira': 'qui', 'Sexta-feira': 'sex', 'Sábado': 'sab', 'Domingo': 'dom', 'seg': 'seg', 'ter': 'ter', 'qua': 'qua', 'qui': 'qui', 'sex': 'sex', 'sab': 'sab', 'dom': 'dom' }), []);

  const handleModeChange = (newMode) => {
    if (typeof setScheduleMode === 'function') {
      startTransition(() => {
        setScheduleMode(newMode);
      });
    }
  };

  const handleCourseChange = (newCourse) => {
    if (typeof setSelectedCourse === 'function') {
      startTransition(() => {
        setSelectedCourse(newCourse);
      });
    }
  };

  const handleClassChange = (newClass) => {
    if (typeof setSelectedClass === 'function') {
      startTransition(() => {
        setSelectedClass(newClass);
      });
    }
  };

  const handleTeacherChange = (newTeacher) => {
    if (typeof setSelectedTeacher === 'function') {
      startTransition(() => {
        setSelectedTeacher(newTeacher);
      });
    }
  };

  const handleWeekChange = (newWeek) => {
    if (typeof setSelectedWeek === 'function') {
      startTransition(() => {
        setSelectedWeek(newWeek);
      });
    }
  };


  const horariosFiltrados = React.useMemo(() => {
    if (!schedules || !Array.isArray(schedules)) return [];
    
    const dbType = scheduleMode === 'consolidado' ? 'oficial' : scheduleMode;

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

    // De-duplicação: Se temos 'oficial' e 'atual' no mesmo slot, preferimos 'atual'
    if (scheduleMode === 'atual' || scheduleMode === 'consolidado') {
        const dedupMap = new Map();
        filtered.forEach(s => {
           // Chave robusta usando campos garantidos pela API (dayOfWeek, slotId, classId)
           const key = `${s.week_id || s.weekId}-${s.dayOfWeek || s.day}-${s.slotId || s.time}-${s.classId || s.className}-${s.subjectName || s.subject}`;
           if (!dedupMap.has(key) || s.type === 'atual') {
               dedupMap.set(key, s);
           }
        });
        return Array.from(dedupMap.values());
    }

    return filtered;
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
    // REGRA PARA PROFESSOR: Gestão de filtros entre abas
    if (appMode === 'professor') {
        // 1. Ao sair da Grade de Horários ('curso') para qualquer outra aba
        if (previousViewMode.current === 'curso' && viewMode !== 'curso') {
            if (showOnlyMyClasses) setShowOnlyMyClasses(false);
            if (padraoFilterTeacher !== 'Todos') setPadraoFilterTeacher('Todos');
            if (selectedCourse !== 'Todos' && typeof setSelectedCourse === 'function') setSelectedCourse('Todos');
            if (selectedClass && typeof setSelectedClass === 'function') setSelectedClass('');
        }
        // 2. Ao entrar na Grade de Horários vindo de outro lugar (Iniciar limpo)
        if (viewMode === 'curso' && previousViewMode.current !== 'curso') {
            if (typeof setScheduleMode === 'function') setScheduleMode('atual');
            if (showOnlyMyClasses) setShowOnlyMyClasses(false);
            if (padraoFilterTeacher !== 'Todos') setPadraoFilterTeacher('Todos');
        }
        // 3. Ao entrar no Dashboard Geral
        if (viewMode === 'dashboard') {
            if (showOnlyMyClasses) setShowOnlyMyClasses(false);
            if (padraoFilterTeacher !== 'Todos') setPadraoFilterTeacher('Todos');
            if (selectedCourse !== 'Todos' && typeof setSelectedCourse === 'function') setSelectedCourse('Todos');
            if (selectedClass && typeof setSelectedClass === 'function') setSelectedClass('');
        }
    }
    previousViewMode.current = viewMode;
  }, [viewMode, appMode, setScheduleMode, setSelectedCourse, setSelectedClass, showOnlyMyClasses, padraoFilterTeacher, selectedCourse, selectedClass]);

  React.useEffect(() => { 
    fetchRequests(); 
  }, [appMode]);

  const [showVacantInMyClasses, setShowVacantInMyClasses] = useState(false);
  const [dashboardTab, setDashboardTab] = useState('atual');
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
        setPendingRequests(
          reqs.filter((r) => {
            const normalizedStatus = String(r?.status || '').toLowerCase().trim();
            return PENDING_REQUEST_STATUSES.has(normalizedStatus) && String(r?.week_id || '') === String(selectedWeek);
          }),
        );
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
              if (r?.requestId != null && String(req?.id) === String(r.requestId)) {
                return true;
              }

              let prop = req.proposed_slot;
              for (let i = 0; i < 3; i += 1) {
                if (typeof prop === 'string' && (prop.startsWith('{') || prop.startsWith('"'))) {
                  prop = JSON.parse(prop);
                }
              }
              
              let orig = req.original_slot;
              for (let i = 0; i < 3; i += 1) {
                if (typeof orig === 'string' && (orig.startsWith('{') || orig.startsWith('"'))) {
                  orig = JSON.parse(orig);
                }
              }

              const normalizedClass = String(r.classId || r.className || '').trim().toLowerCase();
              const isProp = prop
                && String(prop.day || '').trim() === String(r.day || '').trim()
                && String(prop.time || '').trim() === String(r.time || '').trim()
                && String(prop.classId || prop.className || '').trim().toLowerCase() === normalizedClass;
              const isOrig = orig
                && String(orig.day || '').trim() === String(r.day || '').trim()
                && String(orig.time || '').trim() === String(r.time || '').trim()
                && String(orig.classId || orig.className || '').trim().toLowerCase() === normalizedClass;
              
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
    Promise.all([
      apiClient.fetchCurriculum('matrix'),
      apiClient.fetchCurriculum('class')
    ]).then(([crs, cls]) => {
      setDbCourses(crs || []);
      setDbClasses(cls || []);
    }).catch(e => {
      console.error("Falha ao carregar dicionários", e);
      setDbCourses([]);
      setDbClasses([]);
    });
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

  /**
   * Função Central de Enriquecimento: Garante que cada item de horário possua 
   * todas as propriedades resolvidas (Professor, Disciplina, Metadata JSON).
   */
  const enrichScheduleItem = React.useCallback((s) => {
    if (!s) return null;
    
    // 1. Resolver Nomes Base
    const classObj = dbClasses.find(c => String(c.id) === String(s.classId));
    const courseObj = (dbCourses || []).find(c => String(c.id) === String(s.courseId));
    
    // 2. Resolver Nome da Disciplina (Prioridade: Matrix -> Metadata -> Raw)
    const discName = matrixDisciplinesMap[s.disciplineId] || 
                     disciplinesMeta?.[s.disciplineId]?.name || 
                     subjectHoursMeta?.[s.disciplineId]?.name || 
                     s.subjectName || s.subject || s.disciplineId || 'Disciplina';

    // 3. Resolver Professor (Suporta múltiplos SIAPE/ID separados por vírgula)
    const teacherName = s.teacherId 
      ? String(s.teacherId).split(',').map(id => resolveTeacherName(id, globalTeachers)).join(' / ')
      : 'A Definir';

    // 4. Processar Metadados JSON (Labels: Recuperação, Substituição, etc)
    let extraRecs = {};
    try {
      if (s.records) {
        extraRecs = (typeof s.records === 'string') ? JSON.parse(s.records) : s.records;
        // Caso esteja duplamente codificado como string persistida
        if (typeof extraRecs === 'string') extraRecs = JSON.parse(extraRecs);
      }
    } catch (e) {
      console.warn("Falha no parse de records p/ ID:", s.id, e);
    }

    // 5. Normalizar campos de data/hora
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

  const teacherSummary = React.useMemo(() => {
    if (!siape || !mappedSchedules || !schedules || !academicWeeks) return { atual: [], previa: [], vagas: [] };
    

    // Cálculo de Datas para os Headers
    const weekData = academicWeeks.find(w => String(w.id) === String(selectedWeek));
    
    const getHeaderLabel = (itemDay, weekId) => {
      const dayCode = shortDayMap[itemDay] || itemDay;
      const DayLabel = dayFullLabels[dayCode] || dayCode;
      
      const targetWeekData = academicWeeks.find(w => String(w.id) === String(weekId || selectedWeek));
      if (!targetWeekData || !targetWeekData.start_date) return DayLabel;
      
      const cleanDate = String(targetWeekData.start_date).split('T')[0];
      const d = new Date(cleanDate + 'T12:00:00Z');
      
      if (isNaN(d.getTime())) return DayLabel;
      
      const offset = (dayOrder[dayCode] || 1) - 1;
      d.setUTCDate(d.getUTCDate() + offset);
      
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      return `${DayLabel} ${day}/${month}`;
    };

    // Helper: Agrupar por Dia + Semana (para evitar que Segunda da próx. semana apareça antes de Sexta desta semana)
    const groupByDay = (items) => {
      const groups = {};
      items.forEach(item => {
        const weekId = item.week_id || item.academic_week_id || item.weekId;
        const code = shortDayMap[item.day] || item.day;
        const groupKey = `${weekId}-${code}`;
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push({ ...item, dayCode: code, weekId });
      });
      
      return Object.entries(groups)
        .map(([key, items]) => {
          const [wId, dCode] = key.split('-');
          const weekIdx = academicWeeks.findIndex(w => String(w.id) === String(wId));
          const dayVal = dayOrder[dCode] || 99;
          const sortVal = (weekIdx !== -1 ? weekIdx * 10 : 999) + dayVal;
          
          return {
            sortVal,
            dayCode: dCode,
            weekId: wId,
            dayLabel: getHeaderLabel(dCode, wId),
            items: items.sort((a,b) => a.time.localeCompare(b.time))
          };
        })
        .sort((a,b) => a.sortVal - b.sortVal);
    };

    // 1. Atual (Lógica de "Agora": Esconder passado, transição no penúltimo dia)
    const now = new Date();
    const todayIdx = now.getDay(); // 0 (Dom) a 6 (Sab)
    
    // 0. Identificar a semana REAL de hoje (sem influência do seletor global)
    const nowRef = new Date();
    const refDate = new Date(nowRef);
    if (nowRef.getDay() === 6) refDate.setDate(refDate.getDate() + 2);
    else if (nowRef.getDay() === 0) refDate.setDate(refDate.getDate() + 1);
    refDate.setHours(0,0,0,0);

    const actualCurrentWeek = academicWeeks.find(w => {
        // Usamos splits para garantir que pegamos apenas a data YYYY-MM-DD e evitamos ruído de T00...
        const startStr = String(w.start_date || '').split('T')[0];
        const endStr = String(w.end_date || '').split('T')[0];
        if (!startStr || !endStr) return false;

        const s = new Date(startStr + 'T00:00:00'); 
        const e = new Date(endStr + 'T23:59:59');
        return refDate >= s && refDate <= e;
     });
    const actualCurrentWeekId = actualCurrentWeek ? String(actualCurrentWeek.id) : null;
    
    const actualCurrentWeekIdx = academicWeeks.findIndex(w => String(w.id) === String(actualCurrentWeekId || ''));
    const nextWeekId = (actualCurrentWeekIdx !== -1 && actualCurrentWeekIdx < academicWeeks.length - 1)
      ? String(academicWeeks[actualCurrentWeekIdx + 1].id)
      : null;
    
    // Fallback: Se não encontrou semana atual por data e selectedWeek está vindo vazio do estado global
    const dashboardBaseWeekId = actualCurrentWeekId || selectedWeek || (academicWeeks.length > 0 ? String(academicWeeks[0].id) : null);

    // Lógica de "Agora": Agrupa a semana atual. Se for Sexta/Sáb/Dom, TAMBÉM inclui a próxima semana.
    const validWeekIds = [dashboardBaseWeekId];
    if ((todayIdx === 5 || todayIdx === 6 || todayIdx === 0) && nextWeekId) {
        validWeekIds.push(nextWeekId);
    }

    // 1. Atual (Minha Turma - filtra as semanas válidas e o SIAPE fixo do usuário logado)
    const rawItemsFiltered = (schedules || []).filter(s => {
      if (!s.teacherId) return false;
      const isCorrectType = s.type === 'oficial' || s.type === 'atual';
      const isCorrectWeek = validWeekIds.includes(String(s.week_id));
      const mySiapeStr = String(siape).trim();
      const teacherIds = String(s.teacherId).split(',').map(id => id.trim());
      
      return isCorrectType && isCorrectWeek && teacherIds.includes(mySiapeStr);
    });

    // De-duplicação: Preferimos 'atual' sobre 'oficial'
    const dedupMap = new Map();
    rawItemsFiltered.forEach(s => {
       // BUG FIX: O uso dos nomes de campos originais da tabela 'schedules' no banco (dayOfWeek, slotId, disciplineId) 
       // é crucial aqui pois estamos operando sobre o array 'schedules' bruto antes do enriquecimento.
       const key = `${s.week_id}-${s.dayOfWeek || s.day}-${s.slotId || s.time}-${s.classId || s.className}-${s.disciplineId || s.subject}`;
       if (!dedupMap.has(key) || s.type === 'atual') {
           dedupMap.set(key, s);
       }
    });

    // 3. Vagas (Opcional, se precisar mostrar no dashboard as salas/horários vagos dele)
    // No momento, o resumo do docente foca no que ele TEM de aula.
    
    // Filtro de Dias Passados
    const diaHoje = refDate.getDate();
    const mesHoje = refDate.getMonth();
    const anoHoje = refDate.getFullYear();
    
    const isToday = (dStr) => {
        if (!dStr) return false;
        const parts = dStr.split('/');
        if (parts.length !== 3) return false;
        return parseInt(parts[0]) === diaHoje && parseInt(parts[1]) === (mesHoje + 1) && parseInt(parts[2]) === anoHoje;
    };

    const rawItemsForAtual = Array.from(dedupMap.values())
      .map(s => enrichScheduleItem(s))
      .filter(Boolean);

    // Removemos os dias que já passaram da semana ATUAL, para limpar o dashboard
    // Removemos os dias que já passaram da semana ATUAL, para limpar o dashboard
    // UPDATE: Se for final de semana (Sáb/Dom), mantemos a visibilidade total para conferência
    const atualRaw = rawItemsForAtual.filter(s => {
       if (String(s.week_id) !== String(dashboardBaseWeekId)) return true; // Mostra tudo da próxima semana
       const dayOrderMap = { "seg": 1, "ter": 2, "qua": 3, "qui": 4, "sex": 5, "sab": 6, "dom": 0 };
       const sDayCode = shortDayMap[s.day] || s.day;
       const sDayIdx = dayOrderMap[sDayCode];
       
       // Sábado e Domingo liberam a visualização da semana inteira que passou/está acabando
       if (todayIdx === 0 || todayIdx === 6) return true; 
       
       return sDayIdx >= todayIdx; // Oculta dias passados de segunda a sexta
    });
    const atual = groupByDay(atualRaw);

    // 2. Prévia (Exibe sempre o planejamento da SEMANA SEGUINTE à selecionada no dashboard)
    const currentWeekIdx = academicWeeks.findIndex(w => String(w.id) === String(dashboardBaseWeekId));
    const targetPreviewWeekId = academicWeeks[currentWeekIdx + 1]?.id || dashboardBaseWeekId;

    const previaRaw = targetPreviewWeekId ? (schedules || []).filter(s => 
      s.type === 'previa' && 
      s.teacherId && String(s.teacherId).split(',').includes(String(siape)) && 
      String(s.week_id) === String(targetPreviewWeekId)
    ).map(s => enrichScheduleItem(s)).filter(Boolean) : [];

    const previa = groupByDay(previaRaw, targetPreviewWeekId);

    // 3. Vagas (Busca todas as vagas das turmas que este professor atende - Independente de filtros externos)
    // Precisamos de uma lista de 'classIds' que o professor realmente atende na produção
    const myProdClasses = new Set((schedules || [])
      .filter(s => s.classId && (s.type === 'oficial' || s.type === 'atual') && String(s.teacherId).split(',').includes(String(siape)))
      .map(s => String(s.classId))
    );

    const rawVagasFiltered = (schedules || [])
      .filter(s => 
        s.classId && 
        (s.type === 'oficial' || s.type === 'atual') && 
        String(s.week_id) === String(dashboardBaseWeekId) &&
        (!s.teacherId || s.teacherId === "0000001" || isTeacherPending(s.teacherId)) && 
        myProdClasses.has(String(s.classId))
      );
    
    // De-duplicação de Vagas (evitar oficial/atual no mesmo slot de vaga)
    const dedupVagas = new Map();
    rawVagasFiltered.forEach(s => {
       const key = `${s.week_id}-${s.dayOfWeek || s.day}-${s.slotId || s.time}-${s.classId || s.className}-${s.disciplineId || s.subject}`;
       if (!dedupVagas.has(key) || s.type === 'atual') {
           dedupVagas.set(key, s);
       }
    });

    const vagasRaw = Array.from(dedupVagas.values())
      .map(s => enrichScheduleItem(s))
      .filter(Boolean);

    const vagas = groupByDay(vagasRaw);

    return { atual, previa, vagas };
  }, [siape, schedules, dbClasses, selectedConfigYear, selectedWeek, academicWeeks, matrixDisciplinesMap, disciplinesMeta, subjectHoursMeta, MAP_DAYS, globalTeachers, isTeacherPending]);

   const alunoSummary = React.useMemo(() => {
    if (appMode !== 'aluno' || !selectedClass || !mappedSchedules || !selectedWeek || !academicWeeks || !dbClasses) return { atual: [], previa: [], vagas: [] };
    
    const targetClassObj = dbClasses.find(c => c.name === selectedClass);
    const classIdRef = targetClassObj ? String(targetClassObj.id) : String(selectedClass);
    

    const getHeaderLabel = (itemDay, weekId) => {
      const dayCode = shortDayMap[itemDay] || itemDay;
      const DayLabel = dayFullLabels[dayCode] || dayCode;
      const targetWeekData = academicWeeks.find(w => String(w.id) === String(weekId || selectedWeek));
      if (!targetWeekData || !targetWeekData.start_date) return DayLabel;
      const cleanDate = String(targetWeekData.start_date).split('T')[0];
      const d = new Date(cleanDate + 'T12:00:00Z');
      if (isNaN(d.getTime())) return DayLabel;
      const offset = (dayOrder[dayCode] || 1) - 1;
      d.setUTCDate(d.getUTCDate() + offset);
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      return `${DayLabel} ${day}/${month}`;
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
          const dayVal = dayOrder[dCode] || 99;
          const sortVal = (weekIdx !== -1 ? weekIdx * 10 : 999) + dayVal;
          
          return {
            sortVal,
            dayCode: dCode,
            dayLabel: getHeaderLabel(dCode, wId),
            items: items.sort((a,b) => a.time.localeCompare(b.time))
          };
        })
        .sort((a,b) => a.sortVal - b.sortVal);
    };

    // 0. Identificar a semana REAL de hoje (sem influência do seletor global)
    const nowRef = new Date();
    const refDate = new Date(nowRef);
    if (nowRef.getDay() === 6) refDate.setDate(refDate.getDate() + 2);
    else if (nowRef.getDay() === 0) refDate.setDate(refDate.getDate() + 1);
    refDate.setHours(0,0,0,0);

    const actualCurrentWeek = academicWeeks.find(w => {
        const startStr = String(w.start_date || '').split('T')[0];
        const endStr = String(w.end_date || '').split('T')[0];
        if (!startStr || !endStr) return false;
        const s = new Date(startStr + 'T00:00:00'); 
        const e = new Date(endStr + 'T23:59:59');
        return refDate >= s && refDate <= e;
     });
    const dashboardBaseWeekId = actualCurrentWeek ? String(actualCurrentWeek.id) : (selectedWeek || (academicWeeks.length > 0 ? String(academicWeeks[0].id) : null));

    // 1. Atual (Minha Turma - oficiais da semana identificada como atual)
    const atualRaw = mappedSchedules.filter(s => 
      String(s.classId) === classIdRef &&
      String(s.week || s.week_id || s.academic_week_id) === String(dashboardBaseWeekId)
    );
    const atual = groupByDay(atualRaw, dashboardBaseWeekId);

    // 2. Aulas Vagas (Minha Turma - oficiais sem professor)
    const vagasRaw = atualRaw.filter(s => 
      (!s.teacherId || s.teacherId === 'A Definir' || s.teacherId === '')
    );
    const vagas = groupByDay(vagasRaw);

    // 3. Prévia (Minha Turma - Exibe planejamento da SEMANA SEGUINTE à identificada hoje)
    const currentWeekIdx = academicWeeks.findIndex(w => String(w.id) === String(dashboardBaseWeekId));
    const targetPreviewWeekId = academicWeeks[currentWeekIdx + 1]?.id || dashboardBaseWeekId;

    const previaRaw = targetPreviewWeekId ? (schedules || []).filter(s => 
      s.type === 'previa' && 
      String(s.classId) === classIdRef && 
      String(s.week_id) === String(targetPreviewWeekId)
    ).map(s => enrichScheduleItem(s)).filter(Boolean) : [];
    const previa = groupByDay(previaRaw, targetPreviewWeekId);

    return { atual, previa, vagas };
  }, [appMode, selectedClass, mappedSchedules, schedules, selectedWeek, academicWeeks, enrichScheduleItem]);

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

   const scheduleDerivedCourses = React.useMemo(() => {
     return [...new Set(mappedSchedules.map(s => s.course))].filter(Boolean).sort((a,b) => a.localeCompare(b));
   }, [mappedSchedules]);

   const scheduleDerivedClasses = React.useMemo(() => {
     return [...new Set(mappedSchedules.map(s => s.className))].filter(Boolean).sort((a,b) => a.localeCompare(b));
   }, [mappedSchedules]);

   const dynamicCoursesList = React.useMemo(() => {
     const dbCourseNames = dbCourses.map(c => c.course).filter(Boolean);
     return ['Todos', ...[...new Set([...dbCourseNames, ...scheduleDerivedCourses])].sort((a,b) => a.localeCompare(b))];
   }, [dbCourses, scheduleDerivedCourses]);

   const dynamicClassesList = React.useMemo(() => {
     const dbClassNames = dbClasses.map(c => c.name).filter(Boolean);
     return [...new Set([...dbClassNames, ...scheduleDerivedClasses])].sort((a,b) => a.localeCompare(b));
   }, [dbClasses, scheduleDerivedClasses]);

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
        } else {
          lists = [...new Set(
            mappedSchedules
              .filter(s => String(s.course) === String(selectedCourse))
              .map(s => s.className)
          )]
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
    }, [selectedCourse, dbClasses, dbCourses, dynamicClassesList, appMode, showOnlyMyClasses, schedules, siape, mappedSchedules]);

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
     // Regra Aluno Prévia: Exibir todas as semanas futuras publicadas como prévia
     if (appMode === 'aluno' && scheduleMode === 'previa') {
         const refDate = new Date(now);
         if (now.getDay() === 6) refDate.setDate(refDate.getDate() + 2);
         else if (now.getDay() === 0) refDate.setDate(refDate.getDate() + 1);
         refDate.setHours(0,0,0,0);
         
         const futureWeekIds = sortedWeeks
            .filter(w => new Date(w.start_date + 'T00:00:00') > refDate)
            .map(w => String(w.id));
            
         uniqueWeekIds = uniqueWeekIds.filter(id => futureWeekIds.includes(id));
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
            // Tenta achar a semana atual por data no portal principal
            const now = new Date();
            const refDate = new Date(now);
            if (now.getDay() === 6) refDate.setDate(refDate.getDate() + 2);
            else if (now.getDay() === 0) refDate.setDate(refDate.getDate() + 1);
            refDate.setHours(0,0,0,0);

            const bestWeek = academicWeeks.find(w => {
                const s = new Date(w.start_date + 'T00:00:00'); 
                const e = new Date(w.end_date + 'T23:59:59');
                return refDate >= s && refDate <= e;
            });

            if (bestWeek && validValues.includes(String(bestWeek.id))) {
               if (typeof setSelectedWeek === 'function') setSelectedWeek(String(bestWeek.id));
            } else if (typeof setSelectedWeek === 'function') {
               setSelectedWeek(validValues[0]);
            }
         }
      } else if (!selectedWeek && academicWeeks.length > 0) {
          // Fallback se dynamicWeeksList ainda está carregando mas temos academicWeeks
          const now = new Date();
          const refDate = new Date(now);
          if (now.getDay() === 6) refDate.setDate(refDate.getDate() + 2);
          else if (now.getDay() === 0) refDate.setDate(refDate.getDate() + 1);
          refDate.setHours(0,0,0,0);

          const bestWeek = academicWeeks.find(w => {
              const s = new Date(w.start_date + 'T00:00:00'); 
              const e = new Date(w.end_date + 'T23:59:59');
              return refDate >= s && refDate <= e;
          });
          if (bestWeek && typeof setSelectedWeek === 'function') setSelectedWeek(String(bestWeek.id));
      }
    }, [dynamicWeeksList, academicWeeks, selectedWeek, setSelectedWeek]);

    // Auto-seleção de turma removida para evitar loops de concorrência com o reset do Dashboard.
    // O sistema agora prioriza o estado 'Limpo' no Dashboard e o localStorage no Portal do Aluno.

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
          {/* DASHBOARD (DOCENTE OU ALUNO) */}
          {/* GESTÃO DE DASHBOARDS (COMANDO VS PESSOAL) */}
          {viewMode === "dashboard" && (
            <div className="flex flex-col gap-2 w-full animate-in fade-in duration-500">
              {/* RENDER: DASHBOARD ORIGINAL (Para Alunos, Professores, ou Admin na aba Pessoal) */}
              
                <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in zoom-in duration-700 no-print mt-2">
               
               {/* LADO ESQUERDO: RESUMO DO HORÁRIO (60% no Desktop) */}
               <div className="w-full lg:w-[60%] flex flex-col order-1">
                 <div className={`group flex flex-col h-full min-h-[500px] p-5 sm:p-10 rounded-[2.5rem] sm:rounded-[3rem] border text-left transition-all duration-500 glass-card inner-glow-emerald ${isDarkMode ? "bg-slate-900/40 border-slate-700 hover:border-emerald-500/30 shadow-2xl shadow-emerald-500/5" : "bg-white/60 border-emerald-100 hover:border-emerald-300 shadow-2xl shadow-emerald-500/5"}`}>
                   
                   <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 print:hidden">
                     <div className="flex items-center gap-5">
                       <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-[1.2rem] sm:rounded-[1.5rem] flex items-center justify-center transition-all duration-500 ${isDarkMode ? (appMode === "aluno" ? "bg-emerald-600" : "bg-blue-600") : (appMode === "aluno" ? "bg-emerald-600 shadow-emerald-500/20" : "bg-blue-600 shadow-blue-500/20")} text-white shadow-xl`}>
                         <Clock size={32} />
                       </div>
                       <div>
                         <h2 className={`text-2xl font-black ${isDarkMode ? "text-white" : "text-slate-800"}`}>Resumo do Horário</h2>
                         <p className={`text-xs font-bold uppercase tracking-widest opacity-60 ${isDarkMode ? (appMode === "aluno" ? "text-emerald-400" : "text-blue-400") : (appMode === "aluno" ? "text-emerald-600" : "text-blue-600")}`}>
                           {appMode === "aluno" ? "Agenda da Turma" : "Agenda do Docente"}
                         </p>
                       </div>
                     </div>

                     <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                        <div className={`flex p-1.5 rounded-2xl gap-1 overflow-x-auto no-scrollbar max-w-full glass-card ${isDarkMode ? "bg-slate-950/40 border-slate-800" : "bg-slate-100 border-slate-200"}`}>
                              {["atual", "vagas", "previa"].map(tab => {
                                const tabColors = {
                                  atual: { color: "emerald", icon: Calendar },
                                  vagas: { color: "orange", icon: AlertCircle },
                                  previa: { color: "indigo", icon: Eye }
                                };
                                const { color, icon: Icon } = tabColors[tab];
                                const label = tab === "atual" ? "Atual" : tab === "vagas" ? "Aula Vaga" : "Prévia";
                                const isActive = dashboardTab === tab;

                                return (
                                  <button 
                                    key={tab}
                                    onClick={() => setDashboardTab(tab)} 
                                    className={`group px-4 py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all duration-500 whitespace-nowrap flex items-center gap-3 ${isActive ? (isDarkMode ? `bg-${color}-600 text-white shadow-[0_0_20px_rgba(var(--tw-shadow-color),0.4)]` : `bg-${color}-600 text-white shadow-lg`) : (isDarkMode ? `text-slate-400 hover:text-${color}-400 hover:bg-slate-900` : `text-slate-500 hover:text-${color}-600 hover:bg-white`)}`}
                                    style={{ "--tw-shadow-color": color === 'emerald' ? '16,185,129' : color === 'orange' ? '249,115,22' : '99,102,241' }}
                                  >
                                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-all duration-500 ${isActive ? "bg-white/20 text-white shadow-inner" : (isDarkMode ? `bg-slate-800 text-${color}-400 group-hover:bg-${color}-500 group-hover:text-white` : `bg-${color}-50 text-${color}-600 group-hover:bg-${color}-600 group-hover:text-white shadow-sm`)}`}>
                                      <Icon size={16} className={`transition-all duration-500 ${isActive ? (tab === 'vagas' ? 'animate-bounce' : 'animate-pulse scale-110') : 'group-hover:rotate-12 group-hover:scale-110'}`} />
                                    </div>
                                    {label}
                                  </button>
                                );
                              })}
                        </div>
                        
                      </div>
                   </div>

                    {/* Filtros rápidos no Portal do Aluno */}
                    {appMode === "aluno" && (
                      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 mb-4 rounded-2xl border ${isDarkMode ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-100 shadow-sm"}`}>
                        <div className="space-y-1.5">
                          <label className={`text-[9px] font-black uppercase tracking-[0.2em] ml-1 block ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Filtrar por Curso</label>
                          <SearchableSelect 
                            isDarkMode={isDarkMode} 
                            options={dynamicCoursesList} 
                            value={selectedCourse} 
                            onChange={handleCourseChange} 
                            colorClass={isDarkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-700 shadow-sm"}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className={`text-[9px] font-black uppercase tracking-[0.2em] ml-1 block ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Visualizar Turma</label>
                          <SearchableSelect 
                            isDarkMode={isDarkMode} 
                            options={filteredClassesList} 
                            value={selectedClass} 
                            onChange={handleClassChange} 
                            colorClass={isDarkMode ? "bg-emerald-900/30 border-emerald-800/50 text-emerald-200" : "bg-emerald-50 border-emerald-100 text-emerald-900 shadow-sm"}
                          />
                        </div>
                      </div>
                    )}
                     {/* Seletor de Dias (Abas) para Alunos - Empilhado no Mobile, Linha no Desktop */}
                     {appMode === "aluno" && (
                       <div className="p-1.5 mb-6 no-print bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
                          <div className="flex flex-wrap sm:flex-nowrap gap-1.5 justify-center sm:justify-start sm:overflow-x-auto no-scrollbar scroll-smooth">
                             {safeDays.map(d => {
                                const isSelected = String(selectedDay) === String(d);
                                return (
                                  <button 
                                    key={d} 
                                    onClick={() => setSelectedDay(d)} 
                                    className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${isSelected ? (isDarkMode ? 'bg-emerald-600 text-white shadow-lg' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30') : (isDarkMode ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200')}`}>
                                    {getFormattedDayLabel(d).split(' ')[0]}
                                  </button>
                                );
                             })}
                          </div>
                       </div>
                     )}

                   <div className="flex-1 overflow-y-auto px-4 overflow-x-visible custom-scrollbar space-y-8">
                    {(() => {
                      const summary = appMode === "aluno" ? alunoSummary : teacherSummary;
                      const activeItems = summary[dashboardTab] || [];
                      
                      const today = new Date();
                      const currentDayIdx = today.getDay();
                      const dayCodeMap = { 1: "seg", 2: "ter", 3: "qua", 4: "qui", 5: "sex", 6: "sab", 0: "dom" };
                      const currentDayCode = dayCodeMap[currentDayIdx];
                      const currentTimeVal = today.getHours() * 60 + today.getMinutes();

                      let firstFutureFound = false;
                      let highlightedSubject = null;

                      // Se for aluno, filtra pelo dia selecionado
                      const filteredByDay = (appMode === "aluno" && activeItems.length > 0)
                         ? activeItems.filter(g => g.dayCode === (shortDayMap[selectedDay] || selectedDay))
                         : activeItems;

                      const dayColorMap = {
                         "seg": { primary: "indigo" },
                         "ter": { primary: "emerald" },
                         "qua": { primary: "orange" },
                         "qui": { primary: "rose" },
                         "sex": { primary: "violet" },
                         "sab": { primary: "sky" }
                      };

                      if (filteredByDay.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center h-full py-20 opacity-30">
                             {appMode === "aluno" && !selectedClass ? (
                               <>
                                 <Users size={64} className="mb-4" />
                                 <p className="text-sm font-black uppercase tracking-[0.3em] text-center">Nenhuma Turma Selecionada</p>
                               </>
                             ) : (
                               <>
                                 <AlertCircle size={48} className="mb-4" />
                                 <p className="text-sm font-black uppercase tracking-[0.3em] text-center">Nenhum registro encontrado</p>
                               </>
                             )}
                          </div>
                        );
                      }

                      return filteredByDay.map((grupo, gIdx) => {
                        const colors = dayColorMap[grupo.dayCode] || { primary: "blue" };
                        const isDayToday = grupo.dayCode === currentDayCode;
                        
                        return (
                          <div key={grupo.dayCode + gIdx} className="space-y-4">
                            <div className="flex items-center gap-3">
                              <div className={`h-px flex-1 ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`} />
                              <span className={`text-[10px] font-black uppercase tracking-[0.4em] ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                                {grupo.dayLabel}
                              </span>
                              <div className={`h-px flex-1 ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               {grupo.items.map((aula, idx) => {
                                 const isTarget = (() => {
                                   if (dashboardTab !== "atual") return false;
                                   
                                   // Regra: Se a próxima for igual à destacada, também destaca
                                   if (firstFutureFound && highlightedSubject && (String(aula.subject) === String(highlightedSubject))) {
                                      return true;
                                   }

                                   if (!firstFutureFound) {
                                     const parts = String(aula.time).split("-");
                                     if (parts.length === 2) {
                                       const endParts = parts[1].trim().split(":");
                                       const endVal = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
                                       if (grupo.dayCode === currentDayCode) {
                                         if (currentTimeVal < endVal) { 
                                           firstFutureFound = true; 
                                           highlightedSubject = aula.subject;
                                           return true; 
                                         }
                                       } else {
                                          const dayOrderMap = { "seg": 1, "ter": 2, "qua": 3, "qui": 4, "sex": 5, "sab": 6, "dom": 0 };
                                          const itemDayIdx = dayOrderMap[grupo.dayCode];
                                          if (itemDayIdx > currentDayIdx || (currentDayIdx === 6 && itemDayIdx === 1)) {
                                             firstFutureFound = true; 
                                             highlightedSubject = aula.subject;
                                             return true;
                                          }
                                       }
                                     }
                                   }
                                   return false;
                                 })();
                                 
                                 const isVaga = isTeacherPending(aula.teacher);
                                 // DEFINIÇÃO DE ESTILOS NEON-GLASS (Fase 3)
                                 let containerClasses = "glass-card transition-all duration-500 hover:scale-[1.02] border-transparent";
                                 let timeColor = isDarkMode ? "text-emerald-400" : "text-emerald-700";
                                 let badgeClasses = isDarkMode ? "bg-slate-900/60 text-slate-400 border-slate-800" : "bg-white/60 text-slate-800 border-slate-100";
                                 let glowClass = isDarkMode ? "inner-glow-emerald" : "";
                                 
                                 if (isVaga) {
                                    containerClasses = "glass-card neon-border-pulsing scale-[1.03] inner-glow-rose border-rose-500/30";
                                    timeColor = "text-rose-500 dark:text-rose-400";
                                    badgeClasses = "bg-rose-600 text-white shadow-lg shadow-rose-500/30 border-rose-400";
                                    glowClass = "inner-glow-rose";
                                 } else if (isTarget) {
                                    containerClasses = "glass-card scale-[1.03] inner-glow-emerald border-emerald-500/40 shadow-emerald-500/10";
                                    timeColor = "text-emerald-500 dark:text-emerald-400";
                                    badgeClasses = "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 border-emerald-400";
                                    glowClass = "inner-glow-emerald";
                                 }

                                 return (
                                   <div 
                                     key={aula.id || idx} 
                                     className={`group/item relative flex items-center justify-between p-5 rounded-[2rem] border transition-all duration-500 m-1.5 ${containerClasses} ${isVaga && appMode === 'professor' && dashboardTab === 'vagas' ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
                                     onClick={() => {
                                       if (appMode === 'professor' && dashboardTab === 'vagas' && isVaga) {
                                           // Verifica restrição de turma
                                           if (userRole !== 'admin' && userRole !== 'gestao' && profClassesMemo && !profClassesMemo.has(String(aula.className))) {
                                               alert("Você só pode assumir vagas em turmas onde você já leciona ao menos uma disciplina.");
                                               return;
                                           }
                                           setVacantRequestModal({
                                               className: aula.className,
                                               day: aula.day,
                                               time: aula.time,
                                               classId: aula.classId,
                                               disciplineId: aula.disciplineId,
                                               subject: aula.subject
                                           });
                                       }
                                     }}
                                   >
                                     <div className="flex flex-col">
                                       <span className={`text-[13px] font-black tracking-tighter ${timeColor}`}>
                                         {aula.time}
                                       </span>
                                       {(() => {
                                         const subjectColorMap = {
                                           0: "text-blue-500 dark:text-blue-400",
                                           1: "text-emerald-500 dark:text-emerald-400",
                                           2: "text-indigo-500 dark:text-indigo-400",
                                           3: "text-rose-500 dark:text-rose-400",
                                           4: "text-amber-500 dark:text-amber-400",
                                           5: "text-sky-500 dark:text-sky-400"
                                          };
                                          const hash = aula.subject ? aula.subject.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
                                          const colorClass = subjectColorMap[hash % 6] || "text-slate-500";
                                          const colorBg = colorClass.replace('text-', 'bg-');

                                          return (
                                            <div className="flex flex-col gap-1">
                                              <span className={`text-[10px] font-bold uppercase tracking-widest leading-tight transition-colors duration-500 ${isTarget ? "text-blue-600 dark:text-blue-400" : colorClass}`}>
                                                {aula.subject || "Horário Agendado"}
                                              </span>
                                              
                                              {/* LABELS DE TIPO / STATUS */}
                                              <div className="flex flex-wrap gap-1">
                                                {isVaga && <span className="px-2 py-0.5 rounded-md text-[7px] font-black bg-rose-600 text-white uppercase tracking-tighter">Aula Vaga</span>}
                                                {aula.isSubstituted && <span className="px-2 py-0.5 rounded-md text-[7px] font-black bg-indigo-600 text-white uppercase tracking-tighter">Substituição</span>}
                                                {aula.isSwap && <span className="px-2 py-0.5 rounded-md text-[7px] font-black bg-emerald-600 text-white uppercase tracking-tighter">Permuta</span>}
                                                {aula.classType && !['regular', 'normal', ''].includes(String(aula.classType).toLowerCase().trim()) && (
                                                  <span className="px-2 py-0.5 rounded-md text-[7px] font-black bg-amber-500 text-white uppercase tracking-tighter">
                                                    {String(aula.classType).toLowerCase().trim() === 'atendimento' ? 'Atendimento ao Aluno' : aula.classType}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>

                                      <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-2">
                                          {(() => {
                                            const hash = aula.subject ? aula.subject.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
                                            const colorClass = (isTarget || isVaga) ? "" : ({0:"text-blue-500 dark:text-blue-400", 1:"text-emerald-500 dark:text-emerald-400", 2:"text-indigo-500 dark:text-indigo-400", 3:"text-rose-500 dark:text-rose-400", 4:"text-amber-500 dark:text-amber-400", 5:"text-sky-500 dark:text-sky-400"}[hash % 6] || "text-slate-500");
                                            const colorBg = colorClass ? colorClass.replace('text-', 'bg-') : (isTarget ? "bg-blue-500" : (isVaga ? "bg-orange-500" : (isDarkMode ? "bg-slate-400" : "bg-slate-500")));
                                            
                                            return (
                                              <>
                                                <div className={`w-1.5 h-1.5 rounded-full ${colorBg}`} />
                                                <span className={`px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all ${badgeClasses} ${colorClass}`}>
                                                  {appMode === "aluno" ? (aula.teacher || "A Definir") : (aula.className)}
                                                </span>
                                              </>
                                            );
                                          })()}
                                        </div>
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
                 </div>
               </div>

               <div className="w-full lg:w-[40%] flex flex-col gap-10 order-2">
                 
                 <div className="space-y-6">
                   <h3 className={`text-[10px] font-black uppercase tracking-[0.3em] ml-4 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Atalhos e Ações</h3>
                   <div className="grid grid-cols-2 gap-4">
                     {appMode === "professor" ? (
                        <>
                          <button onClick={() => { setViewMode("professor"); if(typeof setSelectedTeacher === "function") setSelectedTeacher(siape); }} 
                                  className={`group p-6 rounded-[2rem] border text-left transition-all duration-500 glass-card inner-glow-emerald ${isDarkMode ? "border-slate-800 hover:border-emerald-500/40" : "border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5"}`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500 ${isDarkMode ? "bg-emerald-950/60 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white" : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white shadow-sm"}`}>
                              <UserCircle size={24} />
                            </div>
                            <h3 className={`text-sm font-black mb-1 ${isDarkMode ? "text-emerald-50" : "text-slate-800"}`}>Meu Horário</h3>
                            <p className="text-[10px] font-bold text-slate-500 leading-tight uppercase tracking-tighter">Painel completo</p>
                          </button>

                          <button onClick={() => { setViewMode("professor"); if(typeof setSelectedTeacher === "function") setSelectedTeacher(siape); }} 
                                  className={`group p-6 rounded-[2rem] border text-left transition-all duration-500 glass-card inner-glow-emerald ${isDarkMode ? "border-slate-800 hover:border-emerald-500/40" : "border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5"}`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500 ${isDarkMode ? "bg-emerald-950/60 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white" : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white shadow-sm"}`}>
                              <Calendar size={24} className="transition-transform duration-500 group-hover:scale-110" />
                            </div>
                            <h3 className={`text-sm font-black mb-1 ${isDarkMode ? "text-emerald-50" : "text-slate-800"}`}>Solicitar troca de aulas</h3>
                            <p className="text-[10px] font-bold text-slate-500 leading-tight uppercase tracking-tighter">Grade do dia</p>
                          </button>

                          <button onClick={() => setViewMode("curso")} 
                                  className={`group p-6 rounded-[2rem] border text-left transition-all duration-500 glass-card inner-glow-emerald ${isDarkMode ? "border-slate-800 hover:border-emerald-500/40" : "border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5"}`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500 ${isDarkMode ? "bg-emerald-950/60 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white" : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white shadow-sm"}`}>
                              <Shuffle size={24} className="transition-transform duration-500 group-hover:scale-110" />
                            </div>
                            <h3 className={`text-sm font-black mb-1 ${isDarkMode ? "text-emerald-50" : "text-slate-800"}`}>Grade Global</h3>
                            <p className="text-[10px] font-bold text-slate-500 leading-tight uppercase tracking-tighter">Consultar quadro</p>
                          </button>

                          <button onClick={() => setViewMode("solicitacoes")} 
                                  className={`group p-6 rounded-[2rem] border text-left transition-all duration-500 glass-card inner-glow-emerald ${isDarkMode ? "border-slate-800 hover:border-emerald-500/40" : "border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5"}`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500 ${isDarkMode ? "bg-emerald-950/60 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white" : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white shadow-sm"}`}>
                              <Bell size={24} className="transition-transform duration-500 group-hover:scale-110" />
                            </div>
                            <h3 className={`text-sm font-black mb-1 ${isDarkMode ? "text-emerald-50" : "text-slate-800"}`}>Minhas Solics.</h3>
                            <p className="text-[10px] font-bold text-slate-500 leading-tight uppercase tracking-tighter">Avisos e Pedidos</p>
                          </button>

                          <button onClick={() => setViewMode("total")} 
                                  className={`group p-6 rounded-3xl border text-left transition-all hover:scale-[1.02] ${isDarkMode ? "bg-slate-800 border-slate-700 hover:border-orange-500/50" : "bg-white border-slate-100 hover:border-orange-200 shadow-sm hover:shadow-xl"}`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors ${isDarkMode ? "bg-orange-950 text-orange-400 group-hover:bg-orange-600 group-hover:text-white" : "bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white"}`}>
                              <BarChart3 size={20} className="transition-transform duration-500 group-hover:scale-110" />
                            </div>
                            <h3 className={`text-sm font-black mb-1 ${isDarkMode ? "text-white" : "text-slate-800"}`}>Controle</h3>
                            <p className="text-[10px] font-medium text-slate-500 leading-tight">Controle de carga horária.</p>
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setViewMode("turma")} 
                                  className={`group p-6 rounded-[2rem] border text-left transition-all duration-500 glass-card inner-glow-emerald ${isDarkMode ? "border-slate-800 hover:border-emerald-500/40" : "border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5"}`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500 ${isDarkMode ? "bg-emerald-950/60 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white" : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white shadow-sm"}`}>
                              <Calendar size={24} className="transition-transform duration-500 group-hover:scale-110" />
                            </div>
                            <h3 className={`text-sm font-black mb-1 ${isDarkMode ? "text-emerald-50" : "text-slate-800"}`}>Minha Turma</h3>
                            <p className="text-[10px] font-bold text-slate-500 leading-tight uppercase tracking-tighter">Visualizar horário completo</p>
                          </button>

                          <button onClick={() => setViewMode("professor")} 
                                  className={`group p-6 rounded-[2rem] border text-left transition-all duration-500 glass-card inner-glow-indigo ${isDarkMode ? "border-slate-800 hover:border-indigo-500/40" : "border-slate-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5"}`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500 ${isDarkMode ? "bg-indigo-950/60 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white shadow-sm"}`}>
                              <UserCircle size={24} className="transition-transform duration-500 group-hover:scale-110" />
                            </div>
                            <h3 className={`text-sm font-black mb-1 ${isDarkMode ? "text-indigo-50" : "text-slate-800"}`}>Professor</h3>
                            <p className="text-[10px] font-bold text-slate-500 leading-tight uppercase tracking-tighter">Buscar por docente</p>
                          </button>

                          <button onClick={() => { setViewMode('historico'); setScheduleMode('oficial'); }} 
                                  className={`group p-6 rounded-[2rem] border text-left transition-all duration-500 glass-card inner-glow-orange ${isDarkMode ? "border-slate-800 hover:border-orange-500/40" : "border-slate-100 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-500/5"}`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500 ${isDarkMode ? "bg-orange-950/60 text-orange-400 group-hover:bg-orange-600 group-hover:text-white" : "bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white shadow-sm"}`}>
                              <Clock size={24} className="transition-transform duration-500 group-hover:scale-110" />
                            </div>
                            <h3 className={`text-sm font-black mb-1 ${isDarkMode ? "text-orange-50" : "text-slate-800"}`}>Aulas Passadas</h3>
                            <p className="text-[10px] font-bold text-slate-500 leading-tight uppercase tracking-tighter">Histórico semanal</p>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className={`text-[10px] font-black uppercase tracking-[0.3em] ml-4 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Sistemas IFRO</h3>
                    <div className="flex flex-col gap-4">
                       <a href={appMode === 'professor' ? "https://suap.ifro.edu.br/edu/meus_diarios/" : "https://suap.ifro.edu.br/"} target="_blank" rel="noopener noreferrer" 
                          className={`group flex items-center gap-5 px-8 py-6 rounded-[2.5rem] border transition-all hover:scale-[1.02] ${isDarkMode ? "bg-slate-900 border-slate-800 hover:border-emerald-500/50" : "bg-white border-slate-100 shadow-xl shadow-slate-200/50 hover:border-emerald-200"}`}>
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isDarkMode ? "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white" : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white"}`}>
                            {appMode === 'professor' ? <ClipboardList size={24} /> : <Globe size={24} />}
                          </div>
                          <div className="text-left">
                            <h4 className={`text-sm font-black ${isDarkMode ? "text-white" : "text-slate-900"}`}>{appMode === 'professor' ? 'Meus Diários' : 'Portal SUAP'}</h4>
                            <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">{appMode === 'professor' ? 'Diários e Frequência' : 'Notas e Registros'}</p>
                          </div>
                       </a>

                       <a href={appMode === 'professor' ? "https://sei.ifro.edu.br/" : "https://virtual.ifro.edu.br/jiparana/"} target="_blank" rel="noopener noreferrer" 
                          className={`group flex items-center gap-5 px-8 py-6 rounded-[2.5rem] border transition-all hover:scale-[1.02] ${isDarkMode ? "bg-slate-900 border-slate-800 hover:border-indigo-500/50" : "bg-white border-slate-100 shadow-xl shadow-slate-200/50 hover:border-indigo-200"}`}>
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isDarkMode ? "bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"}`}>
                            {appMode === 'professor' ? <FileText size={24} /> : <Book size={24} />}
                          </div>
                          <div className="text-left">
                            <h4 className={`text-sm font-black ${isDarkMode ? "text-white" : "text-slate-900"}`}>{appMode === 'professor' ? 'SEI IFRO' : 'AVA IFRO'}</h4>
                            <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">{appMode === 'professor' ? 'Processos e Ofícios' : 'Ji-Paraná Virtual'}</p>
                          </div>
                       </a>

                       <a href={appMode === 'professor' ? "https://suap.ifro.edu.br/admin/comum/sala/?agendavel__exact=1&all=&predio__uo=7&tab=tab_any_data" : "https://wa.me/5569999047804"} target="_blank" rel="noopener noreferrer" 
                          className={`group flex items-center gap-5 px-8 py-6 rounded-[2.5rem] border transition-all hover:scale-[1.02] ${isDarkMode ? "bg-slate-900 border-slate-800 hover:border-rose-500/50" : "bg-white border-slate-100 shadow-xl shadow-slate-200/50 hover:border-rose-200"}`}>
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isDarkMode ? "bg-rose-500/10 text-rose-400 group-hover:bg-rose-600 group-hover:text-white" : "bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white"}`}>
                            {appMode === 'professor' ? <MapPin size={24} /> : <MessageCircle size={24} />}
                          </div>
                          <div className="text-left">
                            <h4 className={`text-sm font-black ${isDarkMode ? "text-white" : "text-slate-900"}`}>{appMode === 'professor' ? 'Reservar Salas' : 'WhatsApp CAED'}</h4>
                            <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">{appMode === 'professor' ? 'Agendamento SUAP' : 'Suporte ao Aluno'}</p>
                          </div>
                       </a>

                       {appMode === 'professor' && (
                         <>
                           <a href="https://docs.google.com/spreadsheets/d/1k9Tyy_2pYsJyRKeSq3NpSpXHzUoPigyweyRUHGiAbW4/edit?gid=176889928#gid=176889928" target="_blank" rel="noopener noreferrer" 
                              className={`group flex items-center gap-5 px-8 py-6 rounded-[2.5rem] border transition-all hover:scale-[1.02] ${isDarkMode ? "bg-slate-900 border-slate-800 hover:border-blue-500/50" : "bg-white border-slate-100 shadow-xl shadow-slate-200/50 hover:border-blue-200"}`}>
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isDarkMode ? "bg-blue-500/10 text-blue-400 group-hover:bg-blue-600 group-hover:text-white" : "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"}`}>
                                <Monitor size={24} />
                              </div>
                              <div className="text-left">
                                <h4 className={`text-sm font-black ${isDarkMode ? "text-white" : "text-slate-900"}`}>Labs Informática</h4>
                                <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Planilha de Reserva</p>
                              </div>
                           </a>

                           <a href="https://virtual.ifro.edu.br/jiparana/" target="_blank" rel="noopener noreferrer" 
                              className={`group flex items-center gap-5 px-8 py-6 rounded-[2.5rem] border transition-all hover:scale-[1.02] ${isDarkMode ? "bg-slate-900 border-slate-800 hover:border-indigo-500/50" : "bg-white border-slate-100 shadow-xl shadow-slate-200/50 hover:border-indigo-200"}`}>
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isDarkMode ? "bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"}`}>
                                <Book size={24} />
                              </div>
                              <div className="text-left">
                                <h4 className={`text-sm font-black ${isDarkMode ? "text-white" : "text-slate-900"}`}>AVA (Moodle)</h4>
                                <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Ji-Paraná Virtual</p>
                              </div>
                           </a>
                         </>
                       )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
           )}

        {/* DASHBOARD HEADER: LINKS ALUNO (UX PREMIUM - MOBILE OPTIMIZED) */}


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
            <div className={`rounded-2xl shadow-sm border p-4 space-y-4 no-print print:hidden ${viewMode === 'dashboard' ? 'hidden' : ''} ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              
              {/* Nível 1: Tipos de Visão (Adaptável por Perfil) */}
              <div className={`flex items-center justify-between border-b pb-3 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                <div className={`flex flex-wrap items-center gap-2 p-1.5 rounded-xl shadow-inner w-full ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
                  
                  {appMode === 'professor' ? (
                    <>
                      <button onClick={() => setViewMode('dashboard')} 
                              className={`group flex items-center gap-3 px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${viewMode === 'dashboard' ? "bg-slate-700 text-white shadow-lg" : (isDarkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-100 hover:shadow-sm")}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 ${viewMode === 'dashboard' ? "bg-white/10 text-white" : (isDarkMode ? "bg-slate-900 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white" : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white")}`}>
                          <Home size={14} className="transition-transform duration-500 group-hover:scale-110" />
                        </div>
                        Dashboard
                      </button>

                      <button onClick={() => { setViewMode('professor'); if(typeof setSelectedTeacher === 'function') setSelectedTeacher(siape); setSelectedColleague(''); }} 
                              className={`group flex items-center gap-3 px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${viewMode === 'professor' ? "bg-indigo-600 text-white shadow-lg" : (isDarkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-100 hover:shadow-sm")}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 ${viewMode === 'professor' ? "bg-white/10 text-white" : (isDarkMode ? "bg-slate-900 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white")}`}>
                          <UserCircle size={14} className="transition-transform duration-500 group-hover:scale-110" />
                        </div>
                        Meu Horário
                      </button>

                      <button onClick={() => { setViewMode('curso'); setPadraoFilterTeacher('Todos'); setShowOnlyMyClasses(false); }} 
                              className={`group flex items-center gap-3 px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${viewMode === 'curso' ? "bg-emerald-600 text-white shadow-lg" : (isDarkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-100 hover:shadow-sm")}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 ${viewMode === 'curso' ? "bg-white/10 text-white" : (isDarkMode ? "bg-slate-900 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white" : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white")}`}>
                          <Layers size={14} className="transition-transform duration-500 group-hover:scale-110" />
                        </div>
                        Grade Global
                      </button>

                      <button onClick={() => setViewMode('solicitacoes')} 
                              className={`group flex items-center gap-3 px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${viewMode === 'solicitacoes' ? "bg-indigo-600 text-white shadow-lg" : (isDarkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-100 hover:shadow-sm")}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 ${viewMode === 'solicitacoes' ? "bg-white/10 text-white" : (isDarkMode ? "bg-slate-900 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white")}`}>
                          <Bell size={14} className="transition-transform duration-500 group-hover:rotate-12" />
                        </div>
                        Solicitações
                      </button>

                      <button onClick={() => setViewMode('total')} 
                              className={`group flex items-center gap-3 px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${viewMode === 'total' ? "bg-orange-600 text-white shadow-lg" : (isDarkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-100 hover:shadow-sm")}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 ${viewMode === 'total' ? "bg-white/10 text-white" : (isDarkMode ? "bg-slate-900 text-orange-400 group-hover:bg-orange-600 group-hover:text-white" : "bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white")}`}>
                          <BarChart3 size={14} className="transition-transform duration-500 group-hover:scale-110" />
                        </div>
                        Controle
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setViewMode('dashboard')} 
                              className={`group flex items-center gap-3 px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${viewMode === 'dashboard' ? "bg-slate-700 text-white shadow-lg" : (isDarkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-100 hover:shadow-sm")}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 ${viewMode === 'dashboard' ? "bg-white/10 text-white" : (isDarkMode ? "bg-slate-900 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white" : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white")}`}>
                          <Home size={14} className="transition-transform duration-500 group-hover:scale-110" />
                        </div>
                        Início
                      </button>

                      <button onClick={() => { setViewMode('turma'); if (scheduleMode === 'oficial') handleAlunoScheduleTab('atual'); }} 
                              className={`group flex items-center gap-3 px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${viewMode === 'turma' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40" : (isDarkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-100 hover:shadow-sm")}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 ${viewMode === 'turma' ? "bg-white/20 text-white" : (isDarkMode ? "bg-slate-900 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white" : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white")}`}>
                          <Calendar size={14} className="transition-transform duration-500 group-hover:scale-110" />
                        </div>
                        Minha Turma
                      </button>

                      <button onClick={() => setViewMode('professor')} 
                              className={`group flex items-center gap-3 px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${viewMode === 'professor' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40" : (isDarkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-100 hover:shadow-sm")}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 ${viewMode === 'professor' ? "bg-white/20 text-white" : (isDarkMode ? "bg-slate-900 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white")}`}>
                          <UserCircle size={14} className="transition-transform duration-500 group-hover:scale-110" />
                        </div>
                        Professor
                      </button>

                      <button onClick={() => { setViewMode('historico'); setScheduleMode('oficial'); }} 
                              className={`group flex items-center gap-3 px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${viewMode === 'historico' ? "bg-orange-600 text-white shadow-lg shadow-orange-900/40" : (isDarkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-100 hover:shadow-sm")}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 ${viewMode === 'historico' ? "bg-white/20 text-white" : (isDarkMode ? "bg-slate-900 text-orange-400 group-hover:bg-orange-600 group-hover:text-white" : "bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white")}`}>
                          <Clock size={14} className="transition-transform duration-500 group-hover:scale-110" />
                        </div>
                        Aulas Passadas
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
                        <SearchableSelect isDarkMode={isDarkMode} options={dynamicCoursesList} value={selectedCourse} onChange={handleCourseChange} colorClass={isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 shadow-sm' : 'bg-white border-slate-200 text-slate-700 shadow-sm'} />
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
                        <SearchableSelect isDarkMode={isDarkMode} options={filteredClassesList} value={selectedClass} onChange={handleClassChange} colorClass={scheduleMode === 'previa' ? (isDarkMode ? "bg-violet-900/30 border-violet-800/50 text-violet-200 shadow-sm" : "bg-violet-50 border-violet-100 text-violet-900 shadow-sm") : viewMode === 'hoje' ? (isDarkMode ? "bg-blue-900/30 border-blue-800/50 text-blue-200 shadow-sm" : "bg-blue-50 border-blue-100 text-blue-900 shadow-sm") : (isDarkMode ? "bg-emerald-900/30 border-emerald-800/50 text-emerald-200 shadow-sm" : "bg-emerald-50 border-emerald-100 text-emerald-900 shadow-sm")} />
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
                        onChange={handleTeacherChange} 
                        colorClass={isDarkMode ? "bg-indigo-900/30 border-indigo-800/50 text-indigo-200 shadow-sm" : "bg-indigo-50 border-indigo-100 text-indigo-900 shadow-sm"} 
                      />
                    </div>
                  )}


                  {/* Filters moved to AdminTotalControl */}
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

            {viewMode !== 'solicitacoes' && viewMode !== 'dashboard' && (
              <React.Fragment>
            {/* OPÇÕES DE BASE DE DADOS (Movido para perto da tabela) */}
            {viewMode !== 'total' && (
              <div className={`border p-2.5 rounded-lg shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 mb-2 no-print ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`flex border p-1 rounded-lg w-full md:w-auto shrink-0 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
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
                          <button onClick={() => handleAlunoScheduleTab('historico')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scheduleMode === 'oficial' ? 'bg-emerald-500 text-white shadow-md' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}`}>
                            <Clock size={14} /> Histórico Semanal
                          </button>
                      )}
                    </>
                  ) : (
                    <>
                      {appMode === 'professor' || appMode === 'gestao' || appMode === 'admin' ? (
                        <>
                          <button onClick={() => handleModeChange('atual')} className={`group flex items-center justify-center gap-2.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all duration-500 ${scheduleMode === 'atual' ? 'bg-teal-600 text-white shadow-md shadow-teal-900/40' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm')}`}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-500 ${scheduleMode === 'atual' ? 'bg-white/20' : (isDarkMode ? 'bg-slate-900 text-teal-400 group-hover:bg-teal-600 group-hover:text-white' : 'bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white shadow-sm')}`}>
                               <Sun size={14} className="transition-transform duration-500 group-hover:scale-110" />
                            </div>
                            Atual
                          </button>
                          <button onClick={() => handleModeChange('previa')} className={`group flex items-center justify-center gap-2.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all duration-500 ${scheduleMode === 'previa' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm')}`}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-500 ${scheduleMode === 'previa' ? 'bg-white/20' : (isDarkMode ? 'bg-slate-900 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white shadow-sm')}`}>
                               <Eye size={14} className="transition-transform duration-500 group-hover:scale-110" />
                            </div>
                            Prévia
                          </button>
                          <button onClick={() => handleModeChange('padrao')} className={`group flex items-center justify-center gap-2.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all duration-500 ${scheduleMode === 'padrao' ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm')}`}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-500 ${scheduleMode === 'padrao' ? 'bg-white/20' : (isDarkMode ? 'bg-slate-900 text-amber-400 group-hover:bg-amber-600 group-hover:text-white' : 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white shadow-sm')}`}>
                               <BookOpen size={14} className="transition-transform duration-500 group-hover:scale-110" />
                            </div>
                            Padrão
                          </button>
                          <button onClick={() => handleModeChange('consolidado')} className={`group flex items-center justify-center gap-2.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all duration-500 ${scheduleMode === 'consolidado' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm')}`}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-500 ${scheduleMode === 'consolidado' ? 'bg-white/20' : (isDarkMode ? 'bg-slate-900 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white shadow-sm')}`}>
                               <Calendar size={14} className="transition-transform duration-500 group-hover:scale-110" />
                            </div>
                            Oficial
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handleModeChange('consolidado')} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${scheduleMode === 'consolidado' || scheduleMode === 'oficial' ? 'bg-emerald-500 text-white shadow-md' : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}`}>
                          <Calendar size={14} /> Oficial
                        </button>
                      )}
                    </>
                  )}
                </div>

                {(scheduleMode === 'padrao' || appMode !== 'aluno' || viewMode === 'historico') && dynamicWeeksList.length > 0 && (
                    <div className={`p-1 flex items-center gap-2 rounded-lg border cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <CalendarDays size={18} className={`shrink-0 ml-2 opacity-50 ${isDarkMode ? 'text-white' : 'text-slate-700'}`} />
                    <SearchableSelect isDarkMode={isDarkMode} options={dynamicWeeksList} value={selectedWeek} onChange={handleWeekChange} colorClass={`bg-transparent border-none font-black uppercase tracking-tighter text-[11px] ${isDarkMode ? 'text-white' : 'text-slate-900'}`} placeholder={scheduleMode === 'padrao' ? "A qual semana aplicar?" : "Selecione..."} />
                  </div>
                  )}
              </div>
            )}

            {/* BARRA DE PROGRESSO GLOBAL (ESTILO YOUTUBE) */}
            {isPending && <div className="top-loading-bar" />}

            {/* ÁREA ENCAPSULADA DE EXIBIÇÃO E IMPRESSÃO (COM DESFOQUE DE TRANSIÇÃO) */}
            <div id="printable-area" className={`print:w-full print:p-0 ${isPending ? "page-transition-blur" : "transition-all duration-500"}`}>

              
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


                  {/* TABELA DE CONTROLE (TOTAIS) E ESTATÍSTICAS DIÁRIO */}
                  {viewMode === 'total' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-500">
                      {/* Cabeçalho de Controle Modernizado */}
                      <div className={`print:hidden relative overflow-hidden px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6 rounded-[2.5rem] shadow-2xl border transition-all duration-700 backdrop-blur-xl ${isDarkMode ? 'bg-slate-900/80 border-white/10' : 'bg-slate-900 border-slate-800'}`}>
                         <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg rotate-3">
                               <BarChart3 size={32} />
                            </div>
                            <div>
                               <h2 className="text-xl font-black uppercase tracking-tighter text-white">Controle de Aulas</h2>
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Visão Geral de Integralização</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-4">
                            <button onClick={() => setViewMode('total')} className={`group relative flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 bg-amber-600 text-white shadow-lg shadow-amber-500/30 scale-[1.05] z-10`}>
                               <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center transition-all duration-500 group-hover:scale-110">
                                  <ClipboardList size={16} />
                               </div>
                               Relatório Geral
                               <div className="absolute inset-0 rounded-2xl opacity-0 bg-white/10 group-hover:opacity-100 pointer-events-none transition-opacity" />
                            </button>
                         </div>
                      </div>

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
                      hideTeacherFilter={appMode === 'professor' || appMode === 'aluno'}
                    />
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
                          showOnlyMyClasses={showOnlyMyClasses}
                          setShowOnlyMyClasses={setShowOnlyMyClasses}
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
                      checkPendingSwapRequest={isSlotInvolvedInPendingRequest}
                      siape={siape}
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
      {/* Editor Modal Disabled in Dashboard */}

      {/* SISTEMA DE SOLICITAÇÕES PARA O PROFESSOR (Apenas Fullscreen, Hub Flutuante movido globalmente para HomeApp) */}
      {appMode === 'professor' && viewMode === 'solicitacoes' && (
        <div className="mt-4 w-full animate-in fade-in slide-in-from-bottom-6 duration-700 space-y-6">
          {/* Cabeçalho de Solicitações Modernizado */}
          <div className={`relative overflow-hidden px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6 rounded-[2.5rem] shadow-2xl border transition-all duration-700 backdrop-blur-xl ${isDarkMode ? 'bg-indigo-950/80 border-indigo-800/50' : 'bg-indigo-900 border-indigo-800'}`}>
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg -rotate-3">
                    <MessageSquare size={32} />
                </div>
                <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter text-white">Solicitações</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Central de Atendimento DAPE</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                 <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-white/10 text-white shadow-lg`}>
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                       <Search size={16} />
                    </div>
                    Minhas Mudanças
                 </div>
              </div>
          </div>

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
                          showOnlyMyClasses={showOnlyMyClasses}
                          setShowOnlyMyClasses={setShowOnlyMyClasses}
            weekData={recordsForWeek ? recordsForWeek.filter(r => String(r.teacherId).includes(String(siape))) : []}
            scheduleMode={scheduleMode}
            isFloating={false}
          />
        </div>
      )}

      {vacantRequestModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in zoom-in-95 duration-500">
          <div className={"w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-3xl border transition-all duration-500 " + (isDarkMode ? 'bg-slate-900/80 border-white/10 text-white shadow-indigo-500/10' : 'bg-white/80 border-slate-200/50 text-slate-900')}>
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
              {Object.values(
                [ ...(schedules || []).map(s => enrichScheduleItem(s)), ...mappedSchedules ]
                .filter(r => r && r.teacherId && String(r.teacherId).split(',').includes(String(selectedTeacher || siape)) && String(r.classId) === String(vacantRequestModal.classId || vacantRequestModal.raw?.classId) && !r.isPending && r.classType !== 'AULA VAGA' && !r.isExtra)
                .reduce((acc, curr) => { 
                    if (curr.subject && !acc[curr.subject]) acc[curr.subject] = { id: curr.disciplineId, name: curr.subject };
                    return acc;
                }, {})
              ).map((sub, idx) => (
                  <option key={idx} value={`${sub.id}|${sub.name}`}>{sub.name}</option>
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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in zoom-in-95 duration-500">
          <div className={`w-full max-w-sm p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-3xl flex flex-col items-center text-center transition-all duration-500 ${isDarkMode ? 'bg-slate-900/80 border-white/10 shadow-indigo-500/10' : 'bg-white/80 border-slate-200/50'} border text-slate-900 dark:text-white`}>
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
        <div className="fixed inset-0 z-[200] flex justify-center items-center bg-slate-950/60 backdrop-blur-md p-4 animate-in fade-in duration-500 no-print">
           <div className={`w-full max-w-lg rounded-[2.5rem] shadow-2xl backdrop-blur-3xl border flex flex-col overflow-hidden transition-all duration-500 ${isDarkMode ? 'bg-slate-900/80 border-white/10' : 'bg-white/80 border-slate-200/50'}`}>
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
