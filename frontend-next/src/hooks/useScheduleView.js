/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useMemo, useEffect } from 'react';
import { useScheduleFilters } from './useScheduleFilters';
import { useScheduleStats } from './useScheduleStats';
import { useScheduleDataTransform } from './useScheduleDataTransform';
import { DAYS, MAP_DAYS, isFutureWeek, isCurrentWeek, isDatePastOrToday, isTeacherPending } from "@/lib/dates";

export function useScheduleView({ appMode, rawData, disabledWeeks, targetData, disciplinesMeta, subjectHoursMeta, adminFilterCourses, adminFilterClasses, setAdminFilterClasses, activeDays, classTimes, bimesters = [], siape = null, userRole = null, academicWeeks = [] }) {
  const [viewMode, setViewMode] = useState('hoje');
  const [scheduleMode, setScheduleMode] = useState('oficial'); 

  const todayIndex = new Date().getDay();
  const nameOfToday = MAP_DAYS[todayIndex];
  const defaultSelectedDay = DAYS.includes(nameOfToday) ? nameOfToday : 'Segunda-feira';

  const [selectedDay, setSelectedDay] = useState(defaultSelectedDay);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('Todos');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');

  const [totalFilterYear, setTotalFilterYear] = useState('Todos');
  const [totalFilterTeacher, setTotalFilterTeacher] = useState('Todos');
  const [totalFilterClass, setTotalFilterClass] = useState('Todas');
  const [totalFilterSubject, setTotalFilterSubject] = useState('Todas');

  useEffect(() => {
    if (appMode === 'professor' && siape && !selectedTeacher) {
      setSelectedTeacher(String(siape));
    }
  }, [appMode, siape, selectedTeacher]);

  const activeData = useMemo(() => rawData.filter(r => !disabledWeeks.includes(`${r.week}-${r.type}`)), [rawData, disabledWeeks]);

  const {
    adminAvailableCourses,
    adminAvailableClasses,
    groupedDisciplinesBySerie,
    uniqueYearsData,
    globalTeachersList,
    pendingWeeks,
    targetData: localTargetData
  } = useScheduleDataTransform({
    activeData,
    appMode,
    adminFilterCourses,
    adminFilterClasses,
    setAdminFilterClasses,
    scheduleMode,
    viewMode,
    selectedTeacher,
    setSelectedTeacher,
    siape,
    userRole
  });

  const resolvedTargetData = targetData || localTargetData;

  const { activeWeeksList, recordsForWeek, courses, classesList, activeCourseClasses, courseDaysWithRecords, getCellRecords } = useScheduleFilters({
    appMode,
    scheduleMode,
    viewMode,
    activeData,
    targetData: resolvedTargetData,
    selectedWeek,
    selectedCourse,
    setSelectedCourse,
    selectedClass,
    setSelectedClass,
    activeDays
  });

  // Legacy activeWeeksList auto-reset logic disabled to allow PortalView's dynamicWeeksList exclusive control

  const officialDataForTotal = useMemo(() => {
    return activeData.filter(r => r.type === 'oficial').map(r => {
      let actualDateStr = null;
      if (r.week && academicWeeks && academicWeeks.length > 0) {
        const weekObj = academicWeeks.find(w => String(w.id) === String(r.week));
        if (weekObj && weekObj.start_date) {
           const [y, m, d] = weekObj.start_date.split('-').map(Number);
           const ref = new Date(y, m - 1, d, 12, 0, 0); 
           const dayIdx = MAP_DAYS.indexOf(r.day);
           
           if (dayIdx >= 0) {
              const diff = dayIdx - ref.getDay(); 
              const targetDate = new Date(ref);
              targetDate.setDate(ref.getDate() + diff);
              
              const dd = String(targetDate.getDate()).padStart(2, '0');
              const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
              actualDateStr = `${dd}/${mm}`;
           }
        }
      }
      return { ...r, date: actualDateStr || r.date };
    });
  }, [activeData, academicWeeks]);

  const finalFilteredTotalData = useMemo(() => {
    const res = officialDataForTotal.filter(r => {
      const isNoneOrAll = (val) => ['Nenhum', 'Todos', 'Todas'].includes(val);
      const passYear = isNoneOrAll(totalFilterYear) || r.year === totalFilterYear;
      const passTeacher = isNoneOrAll(totalFilterTeacher) || r.teacher === totalFilterTeacher;
      const passClass = isNoneOrAll(totalFilterClass) || r.className === totalFilterClass;
      const passSubject = isNoneOrAll(totalFilterSubject) || r.subject === totalFilterSubject;
      return passYear && passTeacher && passClass && passSubject;
    });
    return res;
  }, [officialDataForTotal, totalFilterYear, totalFilterTeacher, totalFilterClass, totalFilterSubject]);

  const availableYearsForTotal = useMemo(() => {
    const isNoneOrAll = (val) => ['Nenhum', 'Todos', 'Todas'].includes(val);
    const valid = officialDataForTotal.filter(r =>
        (isNoneOrAll(totalFilterTeacher) || r.teacher === totalFilterTeacher) &&
        (isNoneOrAll(totalFilterClass) || r.className === totalFilterClass) &&
        (isNoneOrAll(totalFilterSubject) || r.subject === totalFilterSubject)
    );
    return ['Todos', 'Nenhum', ...[...new Set(valid.map(r => r.year))].sort().reverse()];
  }, [officialDataForTotal, totalFilterTeacher, totalFilterClass, totalFilterSubject]);

  const availableTeachersForTotal = useMemo(() => {
    const isNoneOrAll = (val) => ['Nenhum', 'Todos', 'Todas'].includes(val);
    const valid = officialDataForTotal.filter(r =>
        (isNoneOrAll(totalFilterYear) || r.year === totalFilterYear) &&
        (isNoneOrAll(totalFilterClass) || r.className === totalFilterClass) &&
        (isNoneOrAll(totalFilterSubject) || r.subject === totalFilterSubject)
    );
    return ['Todos', 'Nenhum', ...[...new Set(valid.map(r => r.teacher))].sort()];
  }, [officialDataForTotal, totalFilterYear, totalFilterClass, totalFilterSubject]);

  const availableClassesForTotal = useMemo(() => {
    const isNoneOrAll = (val) => ['Nenhum', 'Todos', 'Todas'].includes(val);
    const valid = officialDataForTotal.filter(r =>
        (isNoneOrAll(totalFilterYear) || r.year === totalFilterYear) &&
        (isNoneOrAll(totalFilterTeacher) || r.teacher === totalFilterTeacher) &&
        (isNoneOrAll(totalFilterSubject) || r.subject === totalFilterSubject)
    );
    return ['Todas', 'Nenhum', ...[...new Set(valid.map(r => r.className))].sort()];
  }, [officialDataForTotal, totalFilterYear, totalFilterTeacher, totalFilterSubject]);

  const availableSubjectsForTotal = useMemo(() => {
    const isNoneOrAll = (val) => ['Nenhum', 'Todos', 'Todas'].includes(val);
    const valid = officialDataForTotal.filter(r =>
        (isNoneOrAll(totalFilterYear) || r.year === totalFilterYear) &&
        (isNoneOrAll(totalFilterTeacher) || r.teacher === totalFilterTeacher) &&
        (isNoneOrAll(totalFilterClass) || r.className === totalFilterClass)
    );
    return ['Todas', 'Nenhum', ...[...new Set(valid.map(r => r.subject))].sort((a,b) => a.localeCompare(b))];
  }, [officialDataForTotal, totalFilterYear, totalFilterTeacher, totalFilterClass]);

  useEffect(() => { if (!availableYearsForTotal.includes(totalFilterYear)) setTotalFilterYear('Todos'); }, [availableYearsForTotal, totalFilterYear]);
  useEffect(() => { if (!availableTeachersForTotal.includes(totalFilterTeacher)) setTotalFilterTeacher('Todos'); }, [availableTeachersForTotal, totalFilterTeacher]);
  useEffect(() => { if (!availableClassesForTotal.includes(totalFilterClass)) setTotalFilterClass('Todas'); }, [availableClassesForTotal, totalFilterClass]);
  useEffect(() => { if (!availableSubjectsForTotal.includes(totalFilterSubject)) setTotalFilterSubject('Todas'); }, [availableSubjectsForTotal, totalFilterSubject]);

  const sortedBimesters = useMemo(() => {
    const list = (bimesters && bimesters.length > 0) ? bimesters : [
      { name: '1º Bimestre', startDate: '2026-02-04', endDate: '2026-04-19' },
      { name: '2º Bimestre', startDate: '2026-04-20', endDate: '2026-07-07' },
      { name: '3º Bimestre', startDate: '2026-07-22', endDate: '2026-09-27' },
      { name: '4º Bimestre', startDate: '2026-09-29', endDate: '2026-12-19' }
    ];
    return [...list].filter(b => b.endDate).sort((a,b) => new Date(a.endDate) - new Date(b.endDate));
  }, [bimesters]);

  const getBimestreInfo = (dateStr, yearStr) => {
    if (!dateStr || sortedBimesters.length === 0) return null;
    const match = dateStr.match(/(\d{2})\/(\d{2})/);
    if (!match) return null;
    let day = parseInt(match[1]);
    let month = parseInt(match[2]);
    let year = parseInt(yearStr || new Date().getFullYear());
    const recordDate = new Date(year, month - 1, day, 12, 0, 0);

    for (let i = 0; i < sortedBimesters.length; i++) {
      const bEndDate = new Date(sortedBimesters[i].endDate + 'T23:59:59');
      if (recordDate <= bEndDate) {
        return i + 1; // 1-indexed dynamically mapped
      }
    }
    return null;
  };

  const bimestresData = useMemo(() => {
    const bims = { 1: [], 2: [], 3: [], 4: [], extra: [] };

    const sorted = [...finalFilteredTotalData].sort((a,b) => {
      const monthA = parseInt(a.month || 0);
      const dayA = parseInt(a.dayOfMonth || 0);
      const valA = monthA * 100 + dayA;
      const monthB = parseInt(b.month || 0);
      const dayB = parseInt(b.dayOfMonth || 0);
      const valB = monthB * 100 + dayB;
      if (valA !== valB) return valA - valB;
      return a.time.localeCompare(b.time);
    });
    
    sorted.forEach(r => {
      const b = getBimestreInfo(r.date, r.year);
      if (b && !bims[b]) bims[b] = [];

      if (b) bims[b].push(r); else bims.extra.push(r);
    });
    return bims;
  }, [finalFilteredTotalData]);

  useEffect(() => {
    if (viewMode === 'curso' && selectedCourse === 'Todos') {
      const actualCourses = courses.filter(c => c !== 'Todos');
      if (actualCourses.length > 0) setSelectedCourse(actualCourses[0]);
    }
  }, [viewMode, selectedCourse, courses]);

  useEffect(() => {
    if (classesList.length > 0 && (!selectedClass || !classesList.includes(selectedClass))) setSelectedClass(classesList[0]);
  }, [classesList, selectedClass]);

  const { dbSummary, adminStats, alunoStats, profStats, diarioStats } = useScheduleStats({
    rawData, activeData, targetData: resolvedTargetData, finalFilteredTotalData,
    disciplinesMeta, subjectHoursMeta, disabledWeeks, selectedClass, selectedTeacher,
    isFutureWeek, isCurrentWeek, isDatePastOrToday, isTeacherPending
  });

  return {
    viewMode, setViewMode,
    scheduleMode, setScheduleMode,
    selectedDay, setSelectedDay,
    selectedWeek, setSelectedWeek,
    selectedCourse, setSelectedCourse,
    selectedClass, setSelectedClass,
    selectedTeacher, setSelectedTeacher,
    totalFilterYear, setTotalFilterYear,
    totalFilterTeacher, setTotalFilterTeacher,
    totalFilterClass, setTotalFilterClass,
    totalFilterSubject, setTotalFilterSubject,
    activeData,
    adminAvailableCourses,
    adminAvailableClasses,
    groupedDisciplinesBySerie,
    uniqueYearsData,
    globalTeachersList,
    pendingWeeks,
    targetData: resolvedTargetData,
    activeWeeksList, recordsForWeek, courses, classesList, activeCourseClasses, courseDaysWithRecords, getCellRecords,
    availableYearsForTotal, availableTeachersForTotal, availableClassesForTotal, availableSubjectsForTotal,
    finalFilteredTotalData, bimestresData,
    dbSummary, adminStats, alunoStats, profStats, diarioStats,
    activeDays, classTimes, bimesters
  };
}
