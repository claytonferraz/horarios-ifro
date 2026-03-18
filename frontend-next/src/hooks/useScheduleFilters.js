import { useMemo, useEffect } from 'react';



/**
 * Custom hook to handle schedule filtering logic and derived lists.
 */
export function useScheduleFilters({
  appMode,
  scheduleMode,
  viewMode,
  activeData,
  targetData,
  selectedWeek,
  selectedCourse,
  setSelectedCourse,
  selectedClass,
  setSelectedClass,
  activeDays
}) {
  // List of weeks corresponding to the currently active scheduling type (official, default, preview)
  const activeWeeksList = useMemo(() => {
    const uniqueWeeks = [...new Set(targetData.map(r => r.week))];
    const parseSortableStr = (w) => {
      const match = w.match(/(\d{2})\/(\d{2})/);
      return match ? parseInt(match[2]) * 100 + parseInt(match[1]) : 9999;
    };
    return uniqueWeeks.sort((a, b) => parseSortableStr(a) - parseSortableStr(b));
  }, [targetData]);

  // Derived dataset: The actual records matching the current week (unless we view default or student where we see everything active)
  const recordsForWeek = useMemo(() => {
    if (appMode === 'aluno' || scheduleMode === 'padrao') return targetData;
    return targetData.filter(r => r.week === selectedWeek);
  }, [targetData, selectedWeek, appMode, scheduleMode]);

  // Derived courses based on currently selected week's records
  const courses = useMemo(() => {
    return ['Todos', ...[...new Set(recordsForWeek.map(r => r.course))].sort((a, b) => a.localeCompare(b))];
  }, [recordsForWeek]);

  // Auto-select course if viewing by course but current is invalid
  useEffect(() => {
    if (viewMode === 'curso' && selectedCourse === 'Todos') {
      const actualCourses = courses.filter(c => c !== 'Todos');
      if (actualCourses.length > 0) setSelectedCourse(actualCourses[0]);
    }
  }, [viewMode, selectedCourse, courses, setSelectedCourse]);

  // All distinct active classes in view
  const classesList = useMemo(() => {
    return [...new Set(recordsForWeek.filter(r => selectedCourse === 'Todos' || r.course === selectedCourse).map(r => r.className))].sort();
  }, [recordsForWeek, selectedCourse]);

  // Explicit active classes mapped exactly to a specific course
  const activeCourseClasses = useMemo(() => {
    if (!selectedCourse || selectedCourse === 'Todos') return [];
    return [...new Set(recordsForWeek.filter(r => r.course === selectedCourse).map(r => r.className))].sort();
  }, [recordsForWeek, selectedCourse]);

  // Subset of week days that actually have records associated with the selected class or course
  const courseDaysWithRecords = useMemo(() => {
    const daysToUse = activeDays || ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    if (viewMode !== 'curso' || selectedCourse === 'Todos') return daysToUse;
    return daysToUse.filter(day => recordsForWeek.some(r => r.course === selectedCourse && r.day === day));
  }, [viewMode, selectedCourse, recordsForWeek, activeDays]);

  // Maintain valid class selection automatically
  useEffect(() => {
    if (classesList.length > 0 && (!selectedClass || !classesList.includes(selectedClass))) {
      setSelectedClass(classesList[0]);
    }
  }, [classesList, selectedClass, setSelectedClass]);

  // Unified utility proxy to query cells rapidly
  const getCellRecords = (day, time) => {
    if (viewMode === 'hoje' || viewMode === 'turma') {
      return recordsForWeek.filter(r => r.className === selectedClass && r.day === day && r.time === time);
    }
    return [];
  };

  return {
    activeWeeksList,
    recordsForWeek,
    courses,
    classesList,
    activeCourseClasses,
    courseDaysWithRecords,
    getCellRecords
  };
}
