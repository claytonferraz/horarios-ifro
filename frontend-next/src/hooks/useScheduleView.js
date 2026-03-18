/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useMemo, useEffect } from 'react';
import { useScheduleFilters } from './useScheduleFilters';
import { useScheduleStats } from './useScheduleStats';
import { useScheduleDataTransform } from './useScheduleDataTransform';
import { DAYS, MAP_DAYS, isFutureWeek, isCurrentWeek, isDatePastOrToday, isTeacherPending } from "@/lib/dates";

export function useScheduleView({ appMode, rawData, disabledWeeks, targetData, disciplinesMeta, subjectHoursMeta, adminFilterCourses, adminFilterClasses, setAdminFilterClasses, activeDays, classTimes, bimesters = [] }) {
  const [viewMode, setViewMode] = useState('hoje');
  const [scheduleMode, setScheduleMode] = useState('padrao'); 

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
    setSelectedTeacher
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

  useEffect(() => {
    if (activeWeeksList.length > 0 && !activeWeeksList.includes(selectedWeek)) {
      if (scheduleMode === 'oficial') {
        setSelectedWeek(activeWeeksList[activeWeeksList.length - 1]);
      } else {
        setSelectedWeek(activeWeeksList[0]);
      }
    } else if (activeWeeksList.length === 0) {
      setSelectedWeek('');
    }
  }, [activeWeeksList, selectedWeek, scheduleMode]);

  const officialDataForTotal = activeData.filter(r => r.type === 'oficial');

  const finalFilteredTotalData = useMemo(() => {
    return officialDataForTotal.filter(r => {
      const passYear = totalFilterYear === 'Todos' || r.year === totalFilterYear;
      const passTeacher = totalFilterTeacher === 'Todos' || r.teacher === totalFilterTeacher;
      const passClass = totalFilterClass === 'Todas' || r.className === totalFilterClass;
      const passSubject = totalFilterSubject === 'Todas' || r.subject === totalFilterSubject;
      return passYear && passTeacher && passClass && passSubject;
    });
  }, [officialDataForTotal, totalFilterYear, totalFilterTeacher, totalFilterClass, totalFilterSubject]);

  const availableYearsForTotal = useMemo(() => {
    const valid = officialDataForTotal.filter(r =>
        (totalFilterTeacher === 'Todos' || r.teacher === totalFilterTeacher) &&
        (totalFilterClass === 'Todas' || r.className === totalFilterClass) &&
        (totalFilterSubject === 'Todas' || r.subject === totalFilterSubject)
    );
    return ['Todos', ...[...new Set(valid.map(r => r.year))].sort()];
  }, [officialDataForTotal, totalFilterTeacher, totalFilterClass, totalFilterSubject]);

  const availableTeachersForTotal = useMemo(() => {
    const valid = officialDataForTotal.filter(r =>
        (totalFilterYear === 'Todos' || r.year === totalFilterYear) &&
        (totalFilterClass === 'Todas' || r.className === totalFilterClass) &&
        (totalFilterSubject === 'Todas' || r.subject === totalFilterSubject)
    );
    return ['Todos', ...[...new Set(valid.map(r => r.teacher))].sort((a,b) => a.localeCompare(b))];
  }, [officialDataForTotal, totalFilterYear, totalFilterClass, totalFilterSubject]);

  const availableClassesForTotal = useMemo(() => {
    const valid = officialDataForTotal.filter(r =>
        (totalFilterYear === 'Todos' || r.year === totalFilterYear) &&
        (totalFilterTeacher === 'Todos' || r.teacher === totalFilterTeacher) &&
        (totalFilterSubject === 'Todas' || r.subject === totalFilterSubject)
    );
    return ['Todas', ...[...new Set(valid.map(r => r.className))].sort((a,b) => a.localeCompare(b))];
  }, [officialDataForTotal, totalFilterYear, totalFilterTeacher, totalFilterSubject]);

  const availableSubjectsForTotal = useMemo(() => {
    const valid = officialDataForTotal.filter(r =>
        (totalFilterYear === 'Todos' || r.year === totalFilterYear) &&
        (totalFilterTeacher === 'Todos' || r.teacher === totalFilterTeacher) &&
        (totalFilterClass === 'Todas' || r.className === totalFilterClass)
    );
    return ['Todas', ...[...new Set(valid.map(r => r.subject))].sort((a,b) => a.localeCompare(b))];
  }, [officialDataForTotal, totalFilterYear, totalFilterTeacher, totalFilterClass]);

  useEffect(() => { if (!availableYearsForTotal.includes(totalFilterYear)) setTotalFilterYear('Todos'); }, [availableYearsForTotal, totalFilterYear]);
  useEffect(() => { if (!availableTeachersForTotal.includes(totalFilterTeacher)) setTotalFilterTeacher('Todos'); }, [availableTeachersForTotal, totalFilterTeacher]);
  useEffect(() => { if (!availableClassesForTotal.includes(totalFilterClass)) setTotalFilterClass('Todas'); }, [availableClassesForTotal, totalFilterClass]);
  useEffect(() => { if (!availableSubjectsForTotal.includes(totalFilterSubject)) setTotalFilterSubject('Todas'); }, [availableSubjectsForTotal, totalFilterSubject]);

  const sortedBimesters = useMemo(() => {
    return [...(bimesters || [])].filter(b => b.endDate).sort((a,b) => new Date(a.endDate) - new Date(b.endDate));
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
