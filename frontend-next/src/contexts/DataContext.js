"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { apiClient } from "@/lib/apiClient";

const DataContext = createContext();

export function DataProvider({ children }) {
  const [rawData, setRawData] = useState([]);
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

  const loadData = async () => {
    try {
      setIsLoading(true);
      const { schedules, config, academicWeeks: loadedWeeks } = await apiClient.fetchAll(selectedConfigYear);
      
      let combinedData = [];
      if (schedules && Array.isArray(schedules)) {
        schedules.forEach(d => {
          if (d.records) {
            const parsed = JSON.parse(d.records);
            combinedData = [...combinedData, ...parsed.map(r => ({ ...r, updatedAt: d.updatedAt }))];
          }
        });
      }
      setRawData(combinedData);
      
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

      await loadMetadata();
    } catch (err) {
      setErrorMsg("Erro ao carregar dados: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const [globalTeachers, setGlobalTeachers] = useState([]);
  const loadMetadata = async () => {
    try {
      const meta = await apiClient.fetchAdminMeta();
      if (meta) {
        setSubjectHoursMeta(meta.subjectHours || {});
        setDisciplinesMeta(meta.disciplines || {});
        setAcademicYearsMeta(meta.academicYears || {});
      }
      const teachers = await apiClient.fetchTeachers();
      setGlobalTeachers(teachers || []);
    } catch (err) {
      console.warn("Falha ao carregar metadados administrativos:", err.message);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConfigYear]);

  const value = {
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
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
