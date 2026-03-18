import { useState, useRef } from 'react';
import { apiClient } from "@/lib/apiClient";
import { readFileAsync, parseCSV } from '../utils/csvParser';

export function useAdminActions({
  rawData,
  setRawData,
  rawDataRef,
  disabledWeeks,
  setDisabledWeeks,
  refreshData,
  setErrorMsg,
  uploadType
}) {
  const [importUrlModal, setImportUrlModal] = useState({ show: false, url: '' });
  const [pendingUpload, setPendingUpload] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [conflictModal, setConflictModal] = useState({ show: false, weekKey: '', newRecords: [], diffs: [] });
  const [deleteModal, setDeleteModal] = useState({ show: false, weekKey: '', visualName: '' });

  const compareInputRef = useRef(null);
  const addInputRef = useRef(null);
  const [compareTargetWeekKey, setCompareTargetWeekKey] = useState(null);

  const processContent = async (content, originalFileName) => {
    setErrorMsg('');
    try {
      const rawRecords = parseCSV(content, originalFileName);
      
      if (rawRecords.length > 0) {
        if (uploadType === 'padrao') {
          const now = new Date();
          const timestamp = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')} às ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
          const finalFileName = originalFileName === 'url_import.csv' ? `Padrão Anual - ${timestamp}.csv` : originalFileName;
          await finalizeUpload(rawRecords, `Padrão Gerado em ${timestamp}`, finalFileName);
          return true;
        } else {
          setPendingUpload({ parsedData: rawRecords, fileName: originalFileName });
          return true;
        }
      }
      return false;
    } catch(e) { 
      setErrorMsg(`Erro no processamento: ${e.message}`); 
      return false;
    }
  };

  const finalizeUpload = async (rawRecords, weekName, originalFileName) => {
    let currentBase = [...rawDataRef.current];
    const weekKey = `${weekName}-${uploadType}`;
    
    if (uploadType !== 'padrao') {
      const alreadyExists = currentBase.some(r => `${r.week}-${r.type}` === weekKey);
      if (alreadyExists && !confirm(`A semana "${weekName}" [${uploadType.toUpperCase()}] já possui dados. Deseja sobrescrever?`)) {
        return false;
      }
    }

    let finalFileName = originalFileName;
    if (originalFileName === 'url_import.csv' && uploadType !== 'padrao') {
      const currentYear = new Date().getFullYear();
      finalFileName = `${weekName} - ${currentYear}.csv`;
    }
    rawRecords.forEach(r => r.fileName = finalFileName);

    const recordsWithTypes = rawRecords.map(r => ({ ...r, type: uploadType, week: weekName }));
    
    setIsLoading(true);
    try {
      await apiClient.saveSchedule(weekKey, {
        week: weekName,
        type: uploadType,
        fileName: finalFileName,
        records: JSON.stringify(recordsWithTypes)
      });
      refreshData();
      setPendingUpload(null);
    } catch (e) {
      setErrorMsg(`Erro ao salvar no banco: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;
    if (!files || files.length === 0) return;
    if (files.length > 1) { setErrorMsg('Selecione apenas um arquivo por vez.'); return; }
    
    const file = files[0];
    try {
      const content = await readFileAsync(file);
      await processContent(content, file.name);
    } catch(err) {
      setErrorMsg(`Falha na leitura do arquivo: ${err.message}`);
    }
    e.target.value = null; 
  };

  const processUrlUpload = async (e) => {
    e.preventDefault();
    if (!importUrlModal.url) return;
    setIsLoading(true);
    try {
      const response = await fetch(importUrlModal.url);
      if (!response.ok) throw new Error("Acesso negado ou link inválido.");
      const content = await response.text();
      await processContent(content, 'url_import.csv');
      setImportUrlModal({ show: false, url: '' });
    } catch (err) {
      setErrorMsg(`Erro ao importar URL: ${err.message}. Verifique permissões e validade do CSV.`);
      setImportUrlModal({ show: false, url: '' });
    } finally {
      setIsLoading(false);
    }
  };

  const triggerCompare = (weekKey) => { setCompareTargetWeekKey(weekKey); compareInputRef.current.click(); };
  
  const handleCompareFileChange = async (e) => {
    const file = e.target.files[0]; if (!file || !compareTargetWeekKey) return;
    try {
      const parts = compareTargetWeekKey.split('-');
      const isTargetType = parts.pop(); 
      const content = await readFileAsync(file);
      
      let newRecords = parseCSV(content, file.name).map(r => ({ ...r, type: isTargetType }));
      if (isTargetType === 'padrao') {
        newRecords = newRecords.map(r => ({ ...r, week: 'Grade Padrão Anual' }));
      }
      
      const existingRecords = rawDataRef.current.filter(r => `${r.week}-${r.type}` === compareTargetWeekKey);
      const diffs = generateDiffs(existingRecords, newRecords);
      
      if (diffs.length === 0) { setErrorMsg(`Nenhuma alteração detectada.`); setTimeout(() => setErrorMsg(''), 4000); }
      else { setConflictModal({ show: true, weekKey: compareTargetWeekKey, newRecords, diffs }); }
    } catch(e) { setErrorMsg(`Erro: ${e.message}`); }
    e.target.value = null; 
  };

  const generateDiffs = (oldR, newR) => {
    const oldMap = new Map(oldR.map(r => [`${r.day}|${r.time}|${r.className}`, r]));
    const newMap = new Map(newR.map(r => [`${r.day}|${r.time}|${r.className}`, r]));
    const diffs = [];
    newMap.forEach((newRec, key) => {
      const oldRec = oldMap.get(key);
      if (!oldRec) diffs.push({ type: 'NOVO', class: newRec.className, text: `${newRec.day} ${newRec.time}: + ${newRec.subject}` });
      else if (oldRec.subject !== newRec.subject || oldRec.teacher !== newRec.teacher) {
        diffs.push({ type: 'ALTERADO', class: newRec.className, text: `${newRec.day} ${newRec.time}: ${oldRec.subject} ➔ ${newRec.subject}` });
      }
    });
    oldMap.forEach((oldRec, key) => { if (!newMap.has(key)) diffs.push({ type: 'REMOVIDO', class: oldRec.className, text: `${oldRec.day} ${oldRec.time}: - ${oldRec.subject}` }); });
    return diffs;
  };

  const handleConflictResolve = async (choice) => {
    const { weekKey, newRecords } = conflictModal;
    let finalRecords = [];
    
    if (choice === 'replace') {
      finalRecords = newRecords;
    } else {
      const oldWeekData = rawDataRef.current.filter(r => `${r.week}-${r.type}` === weekKey);
      const mergedMap = new Map();
      oldWeekData.forEach(r => mergedMap.set(`${r.day}|${r.time}|${r.className}`, r));
      newRecords.forEach(r => mergedMap.set(`${r.day}|${r.time}|${r.className}`, r));
      finalRecords = Array.from(mergedMap.values());
    }

    const isTargetType = weekKey.split('-').pop();
    const weekName = weekKey.replace(`-${isTargetType}`, '');

    try {
      await apiClient.saveSchedule(weekKey, {
        week: weekName,
        type: isTargetType,
        fileName: "Atualizado via Resolução de Conflitos",
        records: JSON.stringify(finalRecords)
      });
      refreshData(); 
      setConflictModal({ show: false, weekKey: '', newRecords: [], diffs: [] });
      setCompareTargetWeekKey(null);
    } catch(e) { setErrorMsg("Erro ao salvar dados na nuvem."); }
  };

  const handleOpenDelete = (key, visualName) => { setDeleteModal({ show: true, weekKey: key, visualName }); };
  
  const confirmDeletion = async () => {
    const { weekKey } = deleteModal;
    try {
      await apiClient.deleteSchedule(weekKey);
      
      const newDisabled = disabledWeeks.filter(w => w !== weekKey);
      setDisabledWeeks(newDisabled);
      setRawData(prev => prev.filter(r => `${r.week}-${r.type}` !== weekKey));
      rawDataRef.current = rawDataRef.current.filter(r => `${r.week}-${r.type}` !== weekKey);
      
      await apiClient.updateConfig(newDisabled);

      setDeleteModal({ show: false, weekKey: '', visualName: '' });
      refreshData(); 
    } catch(e) { 
      setErrorMsg("Erro ao excluir arquivo."); 
    }
  };

  const toggleVisibility = async (item) => {
    const newDisabled = item.isActive ? [...disabledWeeks, item.key] : disabledWeeks.filter(w => w !== item.key);
    try {
      await apiClient.updateConfig(newDisabled);
      refreshData(); 
    } catch (e) { setErrorMsg("Falha ao atualizar visibilidade."); }
  };

  const handleExportData = () => {
    try {
      const dataStr = JSON.stringify(rawData, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `horarios_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch(e) {
      setErrorMsg(`Erro ao exportar dados: ${e.message}`);
    }
  };

  return {
    importUrlModal, setImportUrlModal,
    pendingUpload, setPendingUpload,
    isLoading, setIsLoading,
    conflictModal, setConflictModal,
    deleteModal, setDeleteModal,
    compareInputRef, addInputRef,
    compareTargetWeekKey, setCompareTargetWeekKey,
    processContent,
    finalizeUpload,
    handleFileUpload,
    processUrlUpload,
    triggerCompare,
    handleCompareFileChange,
    handleConflictResolve,
    handleOpenDelete,
    confirmDeletion,
    toggleVisibility,
    handleExportData
  };
}
