import { useMemo, useEffect } from 'react';
import { isDatePastOrToday, isCurrentWeek, isNextWeek, isFutureWeek } from '@/lib/dates';

export function useScheduleDataTransform({
  activeData,
  appMode,
  adminFilterCourses,
  adminFilterClasses,
  setAdminFilterClasses,
  scheduleMode,
  viewMode,
  selectedTeacher,
  setSelectedTeacher,
  siape = null,
  userRole = null
}) {
  const adminAvailableCourses = useMemo(() => {
    if (appMode !== 'admin') return [];
    return [...new Set(activeData.filter(r => r.type === 'oficial').map(r => r.course))].sort();
  }, [activeData, appMode]);

  const adminAvailableClasses = useMemo(() => {
    if (appMode !== 'admin') return [];
    let filtered = activeData.filter(r => r.type === 'oficial');
    if (adminFilterCourses.length > 0) {
      filtered = filtered.filter(r => adminFilterCourses.includes(r.course));
    }
    return [...new Set(filtered.map(r => r.className))].sort();
  }, [activeData, appMode, adminFilterCourses]);

  useEffect(() => {
    if (adminFilterClasses.length > 0 && adminAvailableClasses.length > 0) {
      const validClasses = adminFilterClasses.filter(c => adminAvailableClasses.includes(c));
      if (validClasses.length !== adminFilterClasses.length) {
        setAdminFilterClasses(validClasses);
      }
    }
  }, [adminAvailableClasses, adminFilterClasses, setAdminFilterClasses]);

  const groupedDisciplinesBySerie = useMemo(() => {
    if (appMode !== 'admin') return {};
    let officialRecords = activeData.filter(r => r.type === 'oficial');

    if (adminFilterCourses.length > 0) {
      officialRecords = officialRecords.filter(r => adminFilterCourses.includes(r.course));
    }
    if (adminFilterClasses.length > 0) {
      officialRecords = officialRecords.filter(r => adminFilterClasses.includes(r.className));
    }

    const grouped = {};

    officialRecords.forEach(r => {
      const serieMatch = r.className.match(/^\d+/);
      const serie = serieMatch ? serieMatch[0] : 'Outras';
      const rowId = `${r.course}|${r.className}|${r.subject}`;
      
      if (!grouped[rowId]) {
        grouped[rowId] = { 
          id: rowId, course: r.course, className: r.className, subject: r.subject, 
          serie: serie, teachers: new Set(), taught: 0 
        };
      }
      
      if (r.teacher && r.teacher !== 'A Definir' && r.teacher !== '-' && !/sem professor/i.test(r.teacher)) {
        grouped[rowId].teachers.add(r.teacher);
      }
      if (isDatePastOrToday(r.date, r.year)) {
        grouped[rowId].taught += 1;
      }
    });

    const arr = Object.values(grouped).map(g => ({
      ...g,
      teachersList: g.teachers.size > 0 ? Array.from(g.teachers).join(' / ') : 'Sem Professor'
    }));

    const bySerie = {};
    arr.forEach(item => {
      if (!bySerie[item.serie]) bySerie[item.serie] = [];
      bySerie[item.serie].push(item);
    });

    Object.keys(bySerie).forEach(s => {
      bySerie[s].sort((a,b) => a.course.localeCompare(b.course) || a.className.localeCompare(b.className) || a.subject.localeCompare(b.subject));
    });

    return bySerie;
  }, [activeData, appMode, adminFilterCourses, adminFilterClasses]);

  const uniqueYearsData = useMemo(() => {
    if (appMode !== 'admin') return [];
    return [...new Set(activeData.filter(r => r.type === 'oficial').map(r => r.year))].sort().reverse();
  }, [activeData, appMode]);

  const globalTeachersList = useMemo(() => {
    return [...new Set(activeData.map(r => r.teacher))]
      .filter(t => t && t !== 'A Definir' && t !== '-' && !/sem professor/i.test(t))
      .sort();
  }, [activeData]);

  useEffect(() => {
    // Se for servidor no portal do professor, trava no próprio SIAPE
    if (appMode === 'professor' && userRole === 'servidor' && siape) {
      if (selectedTeacher !== siape) setSelectedTeacher(siape);
      return;
    }

    if ((appMode === 'professor' || viewMode === 'professor') && (!selectedTeacher || !globalTeachersList.includes(selectedTeacher))) {
      if (globalTeachersList.length > 0) setSelectedTeacher(globalTeachersList[0]);
    }
  }, [appMode, viewMode, globalTeachersList, selectedTeacher, setSelectedTeacher, siape, userRole]);

  const pendingWeeks = useMemo(() => {
    const officialDates = activeData.filter(r => r.type === 'oficial');
    const getVal = (s) => { const m = s.match(/(\d{2})\/(\d{2})/); return m ? parseInt(m[2])*100 + parseInt(m[1]) : 9999; };
    const officialWeeksList = [...new Set(officialDates.map(r => r.week))].sort((a,b) => getVal(a) - getVal(b));
    
    let current = officialDates.find(r => isCurrentWeek(r.date, r.year))?.week;
    let next = officialDates.find(r => isNextWeek(r.date, r.year))?.week;
    
    if (!current && officialWeeksList.length > 0) current = officialWeeksList[0];
    if (!next && officialWeeksList.length > 1) next = officialWeeksList[1];
    else if (!next && officialWeeksList.length > 0) next = officialWeeksList[0];
    
    return { current: current || '', next: next || '' };
  }, [activeData]);

  const targetData = useMemo(() => {
    let data = activeData;
    if (viewMode === 'total') return data.filter(r => r.type === 'oficial');
    if (scheduleMode === 'previa') return data.filter(r => r.type === 'previa');
    if (scheduleMode === 'padrao') return data.filter(r => r.type === 'padrao');

    const dbType = (scheduleMode === 'consolidado' || scheduleMode === 'atual') ? 'oficial' : scheduleMode;
    return data.filter(r => r.type === dbType);
  }, [activeData, viewMode, scheduleMode]);

  return {
    adminAvailableCourses,
    adminAvailableClasses,
    groupedDisciplinesBySerie,
    uniqueYearsData,
    globalTeachersList,
    pendingWeeks,
    targetData
  };
}
