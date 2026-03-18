import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Clock, Copy, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

export function ScheduleEditorModal({ 
  isOpen, onClose, isDarkMode, 
  scheduleMode, selectedWeek,
  className, day, time, timeObj,
  courseRecords, weekData, classTimes
}) {
  const [localRecords, setLocalRecords] = useState([]);
  const [inconsistencies, setInconsistencies] = useState([]);
  const [saving, setSaving] = useState(false);
  const [matrixData, setMatrixData] = useState([]);
  const [classesData, setClassesData] = useState([]);
  const [usersList, setUsersList] = useState([]);

  useEffect(() => {
    if (isOpen) {
      apiClient.fetchCurriculumData('matrix').then(res => setMatrixData(res));
      apiClient.fetchCurriculumData('class').then(res => setClassesData(res));
      apiClient.fetchAdminMeta().then(() => {
         fetch(`${apiClient.config.backendUrl || 'http://localhost:3000'}/api/admin/users`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('dape_token')}` } })
         .then(r => r.json())
         .then(res => setUsersList(res.users || []))
         .catch(e => setUsersList([]));
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const recordsForSlot = courseRecords.filter(r => r.className === className && r.day === day && r.time === time);
      if (recordsForSlot.length > 0) {
        setLocalRecords(JSON.parse(JSON.stringify(recordsForSlot)));
      } else {
        setLocalRecords([{
            id: 'n_' + Date.now(),
            day, time, className, 
            teacher: '', subject: '',
            startTime: timeObj?.startTime || '',
            endTime: timeObj?.endTime || ''
        }]);
      }
      checkInconsistencies();
    }
  }, [isOpen, className, day, time, courseRecords]);

  const checkInconsistencies = () => {
     // Validate all slots for this class in the week against 'aulas_semanais' in matrix
     const classInfo = classesData.find(c => c.name === className);
     if (!classInfo) return setInconsistencies([]);
     
     const matrix = matrixData.find(m => m.id === classInfo.matrixId);
     if (!matrix) return setInconsistencies([]);
     const serie = matrix.series.find(s => s.id === classInfo.serieId);
     if (!serie) return setInconsistencies([]);

     const issues = [];
     const classTotalRecords = courseRecords.filter(r => r.className === className);

     // Check Turn Conflicts
     classTotalRecords.forEach(r => {
        const tObj = classTimes.find(ct => ct.timeStr === r.time);
        if (tObj && classInfo.shift && tObj.shift !== classInfo.shift) {
           issues.push(`Conflito de Turno: Disciplina ${r.subject} alocada em ${tObj.shift} mas a turma é do turno ${classInfo.shift}.`);
        }
     });

     // Check Hours/Quota
     serie.disciplines.forEach(disc => {
        const expected = disc.aulas_semanais || 0;
        const assigned = classTotalRecords.filter(r => r.subject === disc.name).length;
        if (expected > 0 && assigned !== expected) {
           issues.push(`Carga Horária Divergente: ${disc.name} tem ${assigned}/${expected} aulas alocadas na semana.`);
        }
     });

     setInconsistencies([...new Set(issues)]);
  };

  const currentClassObj = classesData.find(c => c.name === className);
  let availableDisciplines = [];
  if (currentClassObj) {
     const matrix = matrixData.find(m => m.id === currentClassObj.matrixId);
     if (matrix) {
        const serie = matrix.series.find(s => s.id === currentClassObj.serieId);
        if (serie) availableDisciplines = serie.disciplines;
     }
  }

  const handleUpdate = (id, field, val) => {
    setLocalRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
    // Auto Suggest Teacher
    if (field === 'subject' && currentClassObj && currentClassObj.professorAssignments) {
       const mappedProfs = currentClassObj.professorAssignments[
         availableDisciplines.find(d => d.name === val)?.id
       ];
       if (mappedProfs && mappedProfs.length > 0) {
          setLocalRecords(prev => prev.map(r => r.id === id ? { ...r, teacher: mappedProfs[0] } : r));
       }
    }
  };

  const handleAddSubSlot = () => {
     setLocalRecords(prev => [...prev, {
         id: 'n_' + Date.now(),
         day, time, className, 
         teacher: '', subject: '',
         startTime: timeObj?.startTime || '',
         endTime: timeObj?.endTime || ''
     }]);
  };

  const handleRemove = (id) => {
     setLocalRecords(prev => prev.filter(r => r.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validar conflitos PROFESSOR na semana toda
      for(const rec of localRecords) {
         if(!rec.teacher) continue;
         const sameTeacherRecords = weekData.records.filter(w => w.teacher === rec.teacher && w.day === day && w.time === time && w.className !== className);
         if (sameTeacherRecords.length > 0) {
            alert(`ATENÇÃO: O professor ${rec.teacher} já está alocado neste horário na turma ${sameTeacherRecords[0].className}! Corrija ou mantenha por sua conta e risco.`);
         }
      }

      // Preparando os novos records pra substituir os antigos
      const cleanedLocal = localRecords.filter(r => r.subject && r.teacher);
      const otherRecords = weekData.records.filter(r => !(r.className === className && r.day === day && r.time === time));
      
      const newRecords = [...otherRecords, ...cleanedLocal];

      await apiClient.saveSchedule(weekData.id || selectedWeek, {
         ...weekData,
         records: JSON.stringify(newRecords)
      });
      // A atualização do front será reativa no próprio componente pai
      onClose(true); // true = refresh needed
    } catch(e) {
       alert("Erro ao salvar: " + e.message);
    } finally {
       setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-xl rounded-2xl shadow-2xl p-6 relative flex flex-col ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}`}>
        <button onClick={() => onClose(false)} className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
          <X size={20} />
        </button>

        <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 mb-2">
          <Clock className="text-indigo-500" /> Editar Grade (Sincronização Ativa)
        </h2>
        <p className="text-xs font-bold opacity-60 mb-6 uppercase tracking-widest">{day} - {time} - TURMA: {className}</p>

        {inconsistencies.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-orange-500/20 border border-orange-500/50 text-orange-400 text-xs">
             <div className="flex items-center gap-2 font-black uppercase tracking-widest mb-2"><AlertCircle size={14}/> Inconsistências na Turma</div>
             <ul className="list-disc pl-5 space-y-1 font-bold">
               {inconsistencies.map((inc, i) => <li key={i}>{inc}</li>)}
             </ul>
          </div>
        )}

        <div className="space-y-4 mb-8">
          {localRecords.map((r, idx) => (
             <div key={r.id} className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60 block mb-1">Disciplina (Da Matriz)</label>
                    <select 
                       value={r.subject} 
                       onChange={e => handleUpdate(r.id, 'subject', e.target.value)} 
                       className={`w-full p-2.5 rounded-lg border font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
                    >
                      <option value="">Selecione...</option>
                      {availableDisciplines.map(d => (
                         <option key={d.id} value={d.name}>{d.name} ({d.aulas_semanais || 0} aulas/sem)</option>
                      ))}
                      {!availableDisciplines.find(d => d.name === r.subject) && r.subject && <option value={r.subject}>{r.subject} (Avulso)</option>}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60 block mb-1">Professor (Da Base Central)</label>
                    <select 
                       value={r.teacher} 
                       onChange={e => handleUpdate(r.id, 'teacher', e.target.value)} 
                       className={`w-full p-2.5 rounded-lg border font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
                    >
                      <option value="">Selecione um Professor...</option>
                      <option value="SEM PROFESSOR">SEM PROFESSOR</option>
                      <option value="SUBSTITUTO">SUBSTITUTO</option>
                      {usersList.map(u => (
                         <option key={u.siape} value={u.nome_exibicao}>{u.nome_exibicao}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                   <button onClick={() => handleRemove(r.id)} className="text-rose-500 hover:text-rose-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><Trash2 size={12}/> Remover Slot</button>
                </div>
             </div>
          ))}

          <button onClick={handleAddSubSlot} className={`w-full py-3 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'border-slate-700 text-slate-500 hover:bg-slate-800' : 'border-slate-300 text-slate-500 hover:bg-slate-100'}`}>
            <Plus size={16} /> Adicionar Professor Divisão/Prática neste Horário
          </button>
        </div>

        <button 
           onClick={handleSave} 
           disabled={saving}
           className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all active:scale-95 disabled:opacity-50"
        >
          {saving ? 'Salvando Integração...' : <><Save size={18} /> Consolidar Horário</>}
        </button>
      </div>
    </div>
  );
}
