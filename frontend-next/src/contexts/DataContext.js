"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { getSocketClient } from "@/lib/socketClient";

const DataContext = createContext();

export function DataProvider({ children }) {
  const { userRole } = useAuth();
  const [rawData, setRawData] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [disabledWeeks, setDisabledWeeks] = useState([]);
  const [activeDays, setActiveDays] = useState(null);
  const [classTimes, setClassTimes] = useState(null);
  const [bimesters, setBimesters] = useState(null);
  const [intervals, setIntervals] = useState([]);
  const [activeDefaultScheduleId, setActiveDefaultScheduleId] = useState(null);
  const [academicWeeks, setAcademicWeeks] = useState([]);
  const [selectedConfigYear, setSelectedConfigYear] = useState(new Date().getFullYear().toString());

  const [subjectHoursMeta, setSubjectHoursMeta] = useState({});
  const [disciplinesMeta, setDisciplinesMeta] = useState({});
  const [academicYearsMeta, setAcademicYearsMeta] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [globalTeachers, setGlobalTeachers] = useState([]);
  const loadMetadata = useCallback(async (role = userRole) => {
    const canLoadAdminData = ['admin', 'gestao'].includes(String(role || '').toLowerCase());
    if (!canLoadAdminData) {
      setSubjectHoursMeta({});
      setDisciplinesMeta({});
      setAcademicYearsMeta({});
      setGlobalTeachers([]);
      return;
    }

    try {
      const meta = await apiClient.fetchAdminMeta(role);
      if (meta) {
        setSubjectHoursMeta(meta.subjectHours || {});
        setDisciplinesMeta(meta.disciplines || {});
        setAcademicYearsMeta(meta.academicYears || {});
      }
      const teachers = await apiClient.fetchTeachers(role);
      setGlobalTeachers(teachers || []);
    } catch (err) {
      console.warn("Falha ao carregar metadados administrativos:", err.message);
    }
  }, [userRole]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const { schedules, config, academicWeeks: loadedWeeks } = await apiClient.fetchAll(selectedConfigYear);
      
      let combinedData = [];
      if (schedules && Array.isArray(schedules)) {
        schedules.forEach(d => {
          if (d.courseName || d.courseId) {
            // New Flat Array model from relational DB
            let extra = {};
            try { if (d.records) extra = JSON.parse(d.records); } catch(e){}
            combinedData.push({
              id: d.id,
              course: d.courseName || d.courseId,
              className: d.className || d.classId,
              day: !isNaN(d.dayOfWeek) ? ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][parseInt(d.dayOfWeek)] : d.dayOfWeek,
              time: d.slotId,
              teacher: String(d.teacherId || ''),
              subject: d.subjectName || d.disciplineId,
              totalHours: parseInt(d.totalHours) || 0,
              suapHours: parseInt(d.suapHours) || 0,
              room: d.room || '',
              type: d.type,
              week: String(d.week_id || ''),
              year: String(d.academic_year || ''),
              updatedAt: d.updatedAt,
              ...extra
            });
          } else if (d.records) {
            // Old JSON format block compatibility
            const parsed = JSON.parse(d.records);
            combinedData = [...combinedData, ...parsed.map(r => ({ ...r, updatedAt: d.updatedAt }))];
          }
        });
      }
      setRawData(combinedData);
      setSchedules(schedules || []);
      
      // Update config, or reset to defaults if missing for the selected year
      if (config) {
        setDisabledWeeks(config.disabledWeeks || []);
        setActiveDays(config.activeDays !== undefined ? config.activeDays : null);
        setClassTimes(config.classTimes !== undefined ? config.classTimes : null);
        setBimesters(config.bimesters !== undefined ? config.bimesters : null);
        setIntervals(config.intervals !== undefined ? config.intervals : []);
        setActiveDefaultScheduleId(config.activeDefaultScheduleId !== undefined ? config.activeDefaultScheduleId : null);
      }
      
      if (loadedWeeks) {
        setAcademicWeeks(loadedWeeks);
      }

      await loadMetadata(userRole);
    } catch (err) {
      setErrorMsg("Erro ao carregar dados: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedConfigYear, loadMetadata, userRole]);

  useEffect(() => {
    loadData();
    
    let socketTimer = null;
    const socket = getSocketClient();
    const onScheduleUpdated = () => {
      console.log('Real-time: Schedule Updated Event Reached. Throttling and refreshing data...');
      clearTimeout(socketTimer);
      socketTimer = setTimeout(() => {
        loadData();
      }, 500); // 500ms debounce
    };
    socket.on('schedule_updated', onScheduleUpdated);

    return () => {
      clearTimeout(socketTimer);
      socket.off('schedule_updated', onScheduleUpdated);
    };
  }, [selectedConfigYear, userRole, loadData]);

  const value = useMemo(() => ({
    rawData,
    setRawData,
    disabledWeeks,
    setDisabledWeeks,
    subjectHoursMeta,
    disciplinesMeta,
    academicYearsMeta,
    globalTeachers,
    setGlobalTeachers,
    activeDays,
    setActiveDays,
    classTimes,
    setClassTimes,
    intervals,
    setIntervals,
    bimesters,
    setBimesters,
    activeDefaultScheduleId,
    setActiveDefaultScheduleId,
    academicWeeks,
    setAcademicWeeks,
    selectedConfigYear,
    setSelectedConfigYear,
    isLoading,
    errorMsg,
    setErrorMsg,
    refreshData: loadData,
    loadAdminMetadata: loadMetadata,
    schedules,
  }), [
    rawData,
    disabledWeeks,
    subjectHoursMeta,
    disciplinesMeta,
    academicYearsMeta,
    globalTeachers,
    activeDays,
    classTimes,
    intervals,
    bimesters,
    activeDefaultScheduleId,
    academicWeeks,
    selectedConfigYear,
    isLoading,
    errorMsg,
    schedules,
    loadData,
    loadMetadata
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
