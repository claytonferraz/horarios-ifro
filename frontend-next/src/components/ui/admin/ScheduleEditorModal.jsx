import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Clock, Copy, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useData } from '@/contexts/DataContext';

export function ScheduleEditorModal({ 
  isOpen, onClose, isDarkMode, 
  scheduleMode, selectedWeek,
  className, day, time, timeObj,
  courseRecords, weekData, classTimes, userRole, siape
}) {
  const [localRecords, setLocalRecords] = useState([]);
  const [extraWeek, setExtraWeek] = useState(selectedWeek || '');
  const [inconsistencies, setInconsistencies] = useState([]);
  const [saving, setSaving] = useState(false);
  const [matrixData, setMatrixData] = useState([]);
  const [classesData, setClassesData] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const { academicWeeks = [], selectedConfigYear } = useData();

  const currentClassObj = classesData.find(c => c.name === className || String(c.id) === String(className));

  const weekOptions = academicWeeks
    .filter(w => String(w.academic_year) === String(selectedConfigYear))
    .sort((a, b) => {
      const aStart = new Date(a.start_date || 0).getTime();
      const bStart = new Date(b.start_date || 0).getTime();
      return aStart - bStart;
    });

  useEffect(() => {
    if (isOpen) {
      apiClient.fetchCurriculum('matrix').then(res => setMatrixData(res));
      apiClient.fetchCurriculum('class').then(res => setClassesData(res));
      apiClient.fetchAdminMeta(userRole).then(() => {
         apiClient.fetchTeachers(userRole).then(res => setUsersList(res || []));
      });
    }
  }, [isOpen, userRole]);

  useEffect(() => {
    if (isOpen) {
      const recordsForSlot = courseRecords.filter(r => (r.className === className || String(r.classId) === String(className)) && r.day === day && r.time === time);
      if (recordsForSlot.length > 0) {
        setLocalRecords(JSON.parse(JSON.stringify(recordsForSlot)));
      } else {
        setLocalRecords([{
            id: 'n_' + Date.now(),
            day, time, className, 
            teacher: '', subject: '',
            startTime: timeObj?.startTime || '',
            endTime: timeObj?.endTime || '',
            classType: 'Regular'
        }]);
      }
      checkInconsistencies();
    }
  }, [isOpen, className, day, time, courseRecords]);

  useEffect(() => {
    if (!isOpen || scheduleMode !== 'padrao') return;
    if (selectedWeek) {
      setExtraWeek(String(selectedWeek));
      return;
    }
    if (weekOptions.length > 0) {
      setExtraWeek(String(weekOptions[0].id));
    }
  }, [isOpen, scheduleMode, selectedWeek, weekOptions]);

  useEffect(() => {
    if (!isOpen) return;
    checkInconsistencies();
  }, [localRecords, classesData, matrixData, usersList, weekData, classTimes, isOpen]);

  const checkInconsistencies = () => {
     // Validate all slots for this class in the week against 'aulas_semanais' in matrix
     const classInfo = classesData.find(c => c.name === className || String(c.id) === String(className));
     if (!classInfo) return setInconsistencies([]);
     
     const matrix = matrixData.find(m => m.id === classInfo.matrixId);
     if (!matrix) return setInconsistencies([]);
     const serie = matrix.series.find(s => s.id === classInfo.serieId);
     if (!serie) return setInconsistencies([]);

     const issues = [];
     const classTotalRecords = courseRecords.filter(r => r.className === className || String(r.classId) === String(className));

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
        // REGRA DE OURO: Somente aulas 'Regular' abatem a carga horária
        const assigned = classTotalRecords.filter(r => r.subject === disc.name && (r.classType === 'Regular' || !r.classType)).length;
        if (expected > 0 && assigned !== expected) {
           issues.push(`Carga Horária Divergente: ${disc.name} tem ${assigned}/${expected} aulas 'Regulares' alocadas na semana.`);
        }
     });

     // Check Saúde Docente (3 Turnos no mesmo dia)
     const profsInThisDay = new Set(weekData.records.filter(r => r.day === day).map(r => r.teacher));
     localRecords.forEach(lr => {
        if(lr.teacher && lr.teacher !== 'SEM PROFESSOR') profsInThisDay.add(lr.teacher);
     });

     profsInThisDay.forEach(profSiape => {
        if(!profSiape) return;
        const profDayRecords = weekData.records.filter(r => r.teacher === profSiape && r.day === day && r.className !== className);
        const currentTeacherLocal = localRecords.filter(lr => lr.teacher === profSiape);
        
        const shifts = new Set(profDayRecords.map(r => {
           const tObj = classTimes.find(ct => ct.timeStr === r.time);
           return tObj ? tObj.shift : null;
        }).filter(Boolean));

        currentTeacherLocal.forEach(() => {
           if(timeObj && timeObj.shift) shifts.add(timeObj.shift);
        });

        if (shifts.size >= 3) {
           const profName = usersList.find(u => u.siape === profSiape)?.nome_exibicao || profSiape;
           issues.push(`ALERTA SAÚDE: O professor ${profName} está alocado nos 3 TURNOS (${Array.from(shifts).join(', ')}) neste dia!`);
        }
     });

     setInconsistencies([...new Set(issues)]);
  };

  let availableDisciplines = [];
  if (currentClassObj) {
     const matrix = matrixData.find(m => m.id === currentClassObj.matrixId);
     if (matrix) {
        const serie = matrix.series.find(s => s.id === currentClassObj.serieId);
        if (serie) {
           availableDisciplines = serie.disciplines;
          if (userRole === 'professor') {
             availableDisciplines = availableDisciplines.filter(d => {
                 const mappedProfs = currentClassObj.professorAssignments?.[d.id] || [];
                 return mappedProfs.includes(String(siape));
             });
           }
        }
     }
  }

  const handleUpdate = (id, field, val) => {
    setLocalRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
    // Auto Suggest Teacher
    if (field === 'subject' && currentClassObj && currentClassObj.professorAssignments) {
       const mappedDiscipline = availableDisciplines.find(d => d.name === val);
       const mappedProfs = mappedDiscipline ? currentClassObj.professorAssignments?.[mappedDiscipline.id] : [];
       if (mappedProfs && mappedProfs.length > 0) {
          setLocalRecords(prev => prev.map(r => r.id === id ? { ...r, subject: val, disciplineId: mappedDiscipline?.id || r.disciplineId, teacher: userRole === 'professor' ? String(siape) : mappedProfs[0] } : r));
       } else if (userRole === 'professor') {
          setLocalRecords(prev => prev.map(r => r.id === id ? { ...r, subject: val, disciplineId: mappedDiscipline?.id || r.disciplineId, teacher: String(siape) } : r));
       } else {
          setLocalRecords(prev => prev.map(r => r.id === id ? { ...r, subject: val, disciplineId: mappedDiscipline?.id || r.disciplineId, teacher: 'A Definir' } : r));
       }
    }
  };

  const handleAddSubSlot = () => {
     setLocalRecords(prev => [...prev, {
         id: 'n_' + Date.now(),
         day, time, className, 
         teacher: userRole === 'professor' ? String(siape) : '', subject: '',
         startTime: timeObj?.startTime || '',
         endTime: timeObj?.endTime || '',
         classType: 'Regular'
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

      if (scheduleMode === 'padrao' && !extraWeek) {
         alert("Por favor, selecione para qual semana esta modificação se aplica!");
         setSaving(false);
         return;
      }

      // Prepara o novo estado do slot (modelo relacional por linha)
      const cleanedLocal = localRecords.filter(r => r.subject && r.teacher);
      const targetWeek = scheduleMode === 'padrao' ? extraWeek : (weekData?.week || selectedWeek);
      const payloadId = weekData?.id || selectedWeek || `s_${Date.now()}`;
      const targetType = scheduleMode === 'padrao' ? 'previa' : (scheduleMode === 'consolidado' ? 'oficial' : scheduleMode);
      const targetAcademicYear = String(weekData?.academic_year || selectedConfigYear || new Date().getFullYear());

      const existingSlotRecords = courseRecords.filter(r => (r.className === className || String(r.classId) === String(className)) && r.day === day && r.time === time);
      const existingIds = existingSlotRecords
        .map(r => String(r.id || ''))
        .filter(id => id && !id.startsWith('n_'));

      const nowSuffix = Date.now();
      const mappedSchedules = cleanedLocal.map((rec, idx) => {
        const mappedDiscipline = availableDisciplines.find(d => d.name === rec.subject);
        const preferredDisciplineId = rec.disciplineId || mappedDiscipline?.id || rec.subject;
        const preferredTeacherId = String(rec.teacher || '').trim();
        const nextId = rec.id && !String(rec.id).startsWith('n_')
          ? String(rec.id)
          : `s_edit_${nowSuffix}_${idx}_${Math.random().toString(36).slice(2, 7)}`;

        return {
          id: nextId,
          courseId: currentClassObj?.matrixId || rec.courseId || null,
          classId: currentClassObj?.id || rec.classId || className,
          dayOfWeek: day,
          slotId: time,
          teacherId: preferredTeacherId,
          disciplineId: preferredDisciplineId,
          room: rec.room || currentClassObj?.room || '',
          classType: rec.classType || 'Regular'
        };
      });

      const nextIds = new Set(mappedSchedules.map(s => String(s.id)));
      const idsToDelete = existingIds.filter(id => !nextIds.has(String(id)));

      if (idsToDelete.length > 0) {
        await Promise.all(idsToDelete.map(id => apiClient.deleteSchedule(id)));
      }

      const payload = {
         id: String(payloadId || targetWeek),
         weekId: String(targetWeek),
         type: targetType,
         academicYear: targetAcademicYear,
         schedules: mappedSchedules
      };

      if (mappedSchedules.length > 0) {
        await apiClient.saveSingleSchedule(payload);
      }
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

        {scheduleMode === 'padrao' && (
           <div className="mb-6 p-4 rounded-xl border bg-indigo-500/10 border-indigo-500/30">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-80 block mb-2 text-indigo-400">Para qual Semana é esta aula avulsa?</label>
              <select 
                 value={extraWeek}
                 onChange={e => setExtraWeek(e.target.value)}
                 className={`w-full p-2.5 rounded-lg border font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
              >
                  <option value="">Selecione a semana alvo...</option>
                  {weekOptions.map(w => {
                     const start = w.start_date ? String(w.start_date).split('-').reverse().slice(0, 2).join('/') : '';
                     const end = w.end_date ? String(w.end_date).split('-').reverse().slice(0, 2).join('/') : '';
                     const label = start && end ? `${w.name} (${start} a ${end})` : w.name;
                     return <option key={w.id} value={String(w.id)}>{label}</option>;
                  })}
              </select>
           </div>
        )}

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
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60 block mb-1">Professor(a)</label>
                    <select
                       value={r.teacher || ''}
                       onChange={e => handleUpdate(r.id, 'teacher', e.target.value)}
                       className={`w-full p-2.5 rounded-lg border font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
                    >
                      <option value="">Selecione...</option>
                      {usersList
                        .filter(u => (u.status || 'ativo') === 'ativo')
                        .map(u => (
                          <option key={u.siape} value={String(u.siape)}>
                            {u.nome_exibicao || u.nome_completo || u.siape}
                          </option>
                        ))}
                      {!usersList.find(u => String(u.siape) === String(r.teacher)) && r.teacher && (
                        <option value={r.teacher}>{r.teacher}</option>
                      )}
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-60 block mb-2">Tipo de Aula (Tipificação)</label>
                  <div className="flex flex-wrap gap-2">
                     {['Regular', 'Recuperação', 'Exame', 'Atendimento'].map(type => (
                       <button
                         key={type}
                         onClick={(e) => {
                            e.preventDefault();
                            handleUpdate(r.id, 'classType', type);
                         }}
                         className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                           (r.classType || 'Regular') === type
                             ? (isDarkMode ? 'bg-indigo-900 border-indigo-500 text-indigo-400 shadow-sm' : 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm')
                             : (isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-500' : 'bg-white border-slate-200 text-slate-400 font-bold')
                         }`}
                       >
                         {type}
                       </button>
                     ))}
                  </div>
                  <p className="text-[9px] mt-1.5 opacity-50 font-bold italic">
                    * Somente aulas &apos;Regulares&apos; abatem a carga horária da matriz.
                  </p>
                </div>
                <div className="flex justify-end mt-3 pt-3 border-t border-dashed border-slate-700/30">
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
