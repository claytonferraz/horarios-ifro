import React, { useState, useEffect } from "react";
import { X, CheckCircle, Search, Calendar, User, Clock, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { SearchableSelect } from "./SearchableSelect";
import { useData } from "@/contexts/DataContext";

export function TeacherDirectModal({
  isOpen,
  onClose,
  onSuccess,
  slotData,
  siape,
  selectedWeek,
  isDarkMode,
  dbClasses = [],
  scheduleMode = "atual"
}) {
  const [loading, setLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [classType, setClassType] = useState("Regular");
  const [selectedTimes, setSelectedTimes] = useState([]);

  const { classTimes, rawData } = useData();

  useEffect(() => {
    if (isOpen && slotData) {
      setSelectedSubject("");
      setClassType("Regular");
      setSelectedTimes([slotData.time]);
    }
  }, [isOpen, slotData]);

  if (!isOpen || !slotData) return null;

  // Usa apenas a turma vinda da célula clicada
  const selectedClass = slotData.className;
  const clickedTimeObj = classTimes.find(t => t.timeStr === slotData.time);
  const currentShift = clickedTimeObj?.shift || "Manhã";
  const shiftTimes = classTimes.filter(t => t.shift === currentShift);

  // O Professor Portal precisa saber quais disciplinas esse SIAPE dá aula.
  // Como as turmas reais estão em rawData, podemos extrair suas disciplinas reais lá!
  const classObj = dbClasses.find(c => c.name === selectedClass);
  let availableSubjects = [];
  
  if (rawData && rawData.length > 0) {
      // 1. Prioriza tentar encontrar a disciplina na turma atual selecionada
      rawData.forEach(r => {
         if (r.teacher && (String(r.teacher) === String(siape) || String(r.teacher).includes(String(siape)))) {
             if (r.className === selectedClass && r.subject && !availableSubjects.some(ex => ex.name === r.subject)) {
                 availableSubjects.push({ name: r.subject, id: r.subject });
             }
         }
      });
      
      // 2. Se a turma atual não gerou nenhuma disciplina, libera qualquer disciplina
      //    que o professor ministra na escola (Fallback de Liberação Total)
      if (availableSubjects.length === 0) {
          rawData.forEach(r => {
             if (r.teacher && (String(r.teacher) === String(siape) || String(r.teacher).includes(String(siape)))) {
                 if (r.subject && !availableSubjects.some(ex => ex.name === r.subject)) {
                     availableSubjects.push({ name: r.subject, id: r.subject });
                 }
             }
          });
      }
  }

  const handleSave = async () => {
    if (!selectedClass || !selectedSubject) {
      alert("Por favor, preencha a Turma e a Disciplina!");
      return;
    }
    if (selectedTimes.length === 0) {
      alert("Por favor, selecione pelo menos um horário!");
      return;
    }

    try {
      setLoading(true);

      const targetType = scheduleMode === 'padrao' ? 'previa' : scheduleMode; 
      const data = await apiClient.fetchAll();
      const currentSchedules = data.schedules || [];
      const targetSchedules = currentSchedules.filter(s => s.type === targetType && String(s.week_id) === String(selectedWeek));
      
      // BUG 3 FIX: usar formato atual de schedules (uma linha por slot) em vez do formato legado (records como array)
      const resolvedClassId = classObj?.id || selectedClass;
      const isOccupied = targetSchedules.some(s =>
          (s.classId === resolvedClassId || s.classId === selectedClass) &&
          s.dayOfWeek === slotData.day &&
          selectedTimes.includes(s.slotId) &&
          s.teacherId &&
          !/A Definir|sem professor|Pendente|-/i.test(s.teacherId)
      );

      if (isOccupied) {
         alert(`Vaga Recusada: Um colega ocupou esta aula exatamente instantes antes de você atualizar.`);
         onSuccess();
         onClose();
         return;
      }
      
      const newRecordsList = selectedTimes.map((selTime, i) => {
          const timeParts = selTime.split(' - ');
          const mappedTimeObj = classTimes.find(t => t.timeStr === selTime) || {};
          return {
            id: `s_${Date.now()}_${i}`,
            courseId: slotData.course || selectedClass || "", 
            classId: selectedClass || "", 
            dayOfWeek: slotData.day,
            slotId: selTime,
            teacherId: String(siape),
            disciplineId: selectedSubject,
            room: null,
            classType: classType,
            // Mantemos os campos abaixo para compatibilizar renderização local rápida caso necessário
            day: slotData.day,
            time: selTime,
            startTime: timeParts[0] || mappedTimeObj.startTime || "",
            endTime: timeParts[1] || mappedTimeObj.endTime || "",
            className: selectedClass,
            subject: selectedSubject,
            teacher: String(siape),
            course: slotData.course || "", 
          };
      });

      const payload = {
         type: targetType,
         weekId: String(selectedWeek),
         academicYear: classObj?.academicYear || null,
         schedules: newRecordsList
      };

      const timeRange = selectedTimes.length > 1 
         ? `${selectedTimes[0].split(' - ')[0]} às ${selectedTimes[selectedTimes.length-1].split(' - ')[1] || selectedTimes[selectedTimes.length-1]}` 
         : selectedTimes[0];
         
      const requestPayload = {
         action: 'lancamento_extra',
         siape: String(siape),
         week_id: String(selectedWeek),
         description: `Solicito o lançamento de ${classType} na turma ${selectedClass} (${slotData.day})`,
         original_slot: { day: slotData.day, time: timeRange, subject: selectedSubject, className: selectedClass },
         proposed_day: slotData.day,
         proposed_time: timeRange,
         proposed_type: classType,
         obs: `Lançamento Extra: ${classType}`,
         proposed_slot: {
             classType: classType,
             subject: selectedSubject,
             className: selectedClass,
             day: slotData.day,
             time: timeRange,
             slots: newRecordsList, 
             targetSubject: selectedSubject,
             classId: selectedClass || "",
             courseId: slotData.course || "", 
             academicYear: null,
             type: targetType
         }
      };
      
      const response = await apiClient.submitRequest(requestPayload);

      // BUG 1 FIX: o backend agora insere o atendimento na grade diretamente no POST.
      // Não é mais necessária uma segunda chamada PUT para acionar o motor.
      if (response && response.autoApproved) {
          alert('Atendimento registrado e inserido na grade automaticamente!');
      } else {
          alert(`A solicitação de ${classType} foi enviada com sucesso e aguarda homologação da Gestão!`);
      }
      
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Erro ao lançar a aula. Detalhes: " + e.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div 
         className={`relative w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-100'}`}
      >
        <div className={`px-6 py-4 flex items-center justify-between border-b ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h2 className={`font-black tracking-widest uppercase text-base ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>Lançamento Direto</h2>
              <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Preenchimento de Horário Livre</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}>
             <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
           
           <div className={`p-4 rounded-2xl flex items-center justify-between shadow-inner ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
             <div className="flex items-center gap-3">
                <Calendar size={18} className={isDarkMode ? 'text-slate-400' : 'text-slate-500'} />
                <div>
                   <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Dia Alvo</p>
                   <p className={`font-bold mt-0.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{slotData.day}</p>
                </div>
             </div>
             
             <div className="w-px h-8 bg-slate-300 dark:bg-slate-600"></div>

             <div className="flex items-start gap-3 w-full sm:w-auto mt-3 sm:mt-0">
                <Clock size={18} className={`mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                <div className="flex-1 min-w-[200px]">
                   <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Múltiplos Horários ({currentShift})
                   </p>
                   <div className="grid grid-cols-2 gap-2 mt-2">
                       {shiftTimes.map(t => (
                          <label key={t.timeStr} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${selectedTimes.includes(t.timeStr) ? (isDarkMode ? 'bg-indigo-900/40 border-indigo-500 shadow-sm' : 'bg-indigo-50 border-indigo-400 shadow-sm') : (isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 hover:bg-slate-50')}`}>
                             <input 
                               type="checkbox" 
                               checked={selectedTimes.includes(t.timeStr)} 
                               onChange={(e) => {
                                  if (e.target.checked) setSelectedTimes(prev => [...prev, t.timeStr]);
                                  else setSelectedTimes(prev => prev.filter(time => time !== t.timeStr));
                               }}
                               className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 rounded border-slate-300 transition-all cursor-pointer"
                             />
                             <span className={`text-[10px] sm:text-xs font-bold leading-none ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{t.timeStr}</span>
                          </label>
                       ))}
                   </div>
                </div>
             </div>
           </div>

           <div className="space-y-4">
              <div>
                <label className={`block text-[10px] font-black tracking-widest uppercase mb-1.5 ml-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Turma Alvo</label>
                <input 
                  type="text"
                  readOnly
                  value={selectedClass}
                  className={`w-full p-3 font-bold text-sm rounded-xl border focus:outline-none transition-all cursor-not-allowed opacity-90 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'}`}
                />
              </div>

              <div>
                <label className={`block text-[10px] font-black tracking-widest uppercase mb-1.5 ml-1 flex justify-between items-center ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                   Sua Disciplina
                   {availableSubjects.length === 0 && <span className="text-[8px] text-amber-500 font-bold">(Nenhum vínculo achado)</span>}
                </label>
                <select 
                  className={`w-full p-3 font-bold text-sm rounded-xl border focus:ring-2 focus:outline-none transition-all cursor-pointer ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:ring-indigo-500/50' : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-indigo-500/20 shadow-sm'}`}
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                >
                   {availableSubjects.length === 0 ? (
                      <option value="" disabled>-- Base dados incompleta --</option>
                   ) : (
                      <option value="" disabled>-- Escolha sua matéria --</option>
                   )}
                   {availableSubjects.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
                {availableSubjects.length === 0 && (
                   <p className={`text-[9px] mt-2 px-2 flex justify-between gap-2 leading-tight ${isDarkMode ? 'text-amber-400/80' : 'text-amber-600/80'}`}>
                      Se a disciplina não carregou, feche e abra o modal novamente ou peça suporte à Gestão para vincular seu SIAPE à matriz.
                   </p>
                )}
              </div>

              <div>
                <label className={`block text-[10px] font-black tracking-widest uppercase mb-1.5 ml-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Motivo / Tipo de Aula</label>
                <div className={`flex flex-wrap gap-2 p-1.5 shadow-inner rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                   {['Regular', 'Recuperação', 'Exame Final', 'Atendimento ao aluno'].map(tipo => (
                      <button 
                        key={tipo}
                        onClick={() => setClassType(tipo)}
                        className={`flex-1 min-w-[100px] py-2 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${classType === tipo ? 'bg-indigo-500 text-white shadow-md ring-2 ring-indigo-500/30' : (isDarkMode ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-800 hover:bg-white')}`}
                      >
                         {tipo}
                      </button>
                   ))}
                </div>
              </div>
           </div>

        </div>

        <div className={`p-5 flex justify-end gap-3 border-t ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
           <button onClick={onClose} className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}>
             Cancelar
           </button>
           <button 
              onClick={handleSave} 
              disabled={loading || !selectedSubject || !selectedClass}
              className={`px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 ${(loading || !selectedSubject || !selectedClass) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'} ${isDarkMode ? 'bg-indigo-600 text-white shadow-indigo-900/40 hover:bg-indigo-500' : 'bg-indigo-600 text-white shadow-indigo-600/30 hover:bg-indigo-700'}`}
           >
             {loading ? 'Processando...' : 'Confirmar e Lançar'}
           </button>
        </div>
      </div>
    </div>
  );
}
