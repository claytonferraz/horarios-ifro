import React, { useState, useMemo } from 'react';
import { X, Send, AlertCircle, HandHeart } from 'lucide-react';
import { resolveTeacherName } from '@/lib/dates';

export function TeacherOfferModal({
  isOpen, onClose, isDarkMode, 
  originalRecord, targetClass, targetCourse, classRecords = [], 
  safeDays = [], safeTimes = [], globalTeachers = [],
  apiClient, selectedWeek, onSubmit
}) {
  const [selectedDiscipline, setSelectedDiscipline] = useState('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1) Agrupar aulas seguidas do mesmo professor
  const consecutiveSlots = useMemo(() => {
    if (!originalRecord || !classRecords) return [];
    // Busca robusta: compara SIAPE ou Nome para garantir o agrupamento correto
    const mySlots = classRecords.filter(r => 
      (r.teacher === originalRecord.teacher || (r.teacherId === originalRecord.teacherId && r.teacherId)) && 
      r.day === originalRecord.day
    );
    const timeOrder = safeTimes.map(t => t.timeStr || t);
    mySlots.sort((a,b) => timeOrder.indexOf(a.time) - timeOrder.indexOf(b.time));

    let block = [];
    let origIdx = mySlots.findIndex(r => r.time === originalRecord.time);
    if(origIdx === -1) return [originalRecord];
    
    block.push(mySlots[origIdx]);
    let curr = timeOrder.indexOf(mySlots[origIdx].time);
    for(let i = origIdx + 1; i < mySlots.length; i++) {
        let next = timeOrder.indexOf(mySlots[i].time);
        if(next === curr + 1 && mySlots[i].subject === originalRecord.subject) {
            block.push(mySlots[i]);
            curr = next;
        } else break;
    }
    curr = timeOrder.indexOf(mySlots[origIdx].time);
    for(let i = origIdx - 1; i >= 0; i--) {
        let prev = timeOrder.indexOf(mySlots[i].time);
        if(prev === curr - 1 && mySlots[i].subject === originalRecord.subject) {
            block.unshift(mySlots[i]);
            curr = prev;
        } else break;
    }
    return block;
  }, [originalRecord, classRecords, safeTimes]);

  const availableDisciplines = useMemo(() => {
      const others = classRecords.filter(r => r.teacher !== originalRecord.teacher && r.subject);
      const unique = [];
      const seen = new Set();
      others.forEach(o => {
          if(!seen.has(o.subject)) {
              seen.add(o.subject);
              unique.push({ subject: o.subject, teacher: o.teacher });
          }
      });
      return unique;
  }, [classRecords, originalRecord]);

  if (!isOpen || !originalRecord) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const targetStr = selectedDiscipline === 'ALL' 
         ? 'Livre para Qualquer Professor (Vaga)' 
         : `Prioridade para a disciplina ${selectedDiscipline}`;

      const timeRange = consecutiveSlots.length > 1 
         ? `${consecutiveSlots[0].time.split(' - ')[0]} às ${consecutiveSlots[consecutiveSlots.length-1].time.split(' - ')[1] || consecutiveSlots[consecutiveSlots.length-1].time}`
         : consecutiveSlots[0].time;

      const payload = {
        action: 'oferta_vaga',
        targetClass: targetClass,
        originalRecord: originalRecord,
        returnWeekId: selectedWeek,
        reason: `Disponibilização de Aula - Data: ${originalRecord.day} (${timeRange})`,
        obs: targetStr,
        proposedSlot: {
           day: originalRecord.day,
           time: timeRange,
           slots: consecutiveSlots,
            subject: selectedDiscipline === 'ALL' ? 'Livre' : selectedDiscipline,
            className: targetClass,
            course: originalRecord.course || targetCourse || '',
            classId: consecutiveSlots[0]?.classId || targetClass
         }
      };

      if (typeof onSubmit === 'function') {
        await onSubmit(payload);
      } else {
        await apiClient.submitRequest({
          action: 'oferta_vaga',
          requester: originalRecord.teacher,
          siape: originalRecord.teacher,
          week_id: selectedWeek,
          returnWeekId: selectedWeek,
          targetClass: targetClass,
          description: payload.reason,
          reason: payload.reason,
          original_slot: { 
             day: originalRecord.day, 
             time: originalRecord.time,
             subject: originalRecord.subject,
             className: targetClass
          },
          proposed_slot: payload.proposedSlot,
          obs: targetStr
        });
        alert('Disponibilização enviada com sucesso! Um aviso foi gerado para a coordenação.');
      }
      onClose();
    } catch (e) {
      setErrorMsg(e.message || 'Erro ao submeter a disponibilização.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex justify-center items-center bg-slate-950/60 backdrop-blur-md p-4 animate-in fade-in duration-500">
      <div className={`w-full max-w-2xl rounded-[2.5rem] shadow-2xl border flex flex-col max-h-[90vh] backdrop-blur-3xl transition-all duration-500 ${isDarkMode ? 'bg-slate-900/80 border-white/10' : 'bg-white/80 border-slate-200/50'}`}>
        
        {/* HEADER */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
           <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-500/20 text-indigo-500 rounded-lg">
                <HandHeart size={20} />
             </div>
             <div>
                <h3 className={`font-black text-sm uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  Disponibilizar Aulas
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                  Turma: {targetClass} ({selectedWeek})
                </p>
             </div>
           </div>
           <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}>
             <X size={20}/>
           </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
           <div className={`p-4 rounded-xl border flex flex-col gap-2 shadow-sm ${isDarkMode ? 'bg-indigo-900/20 border-indigo-800/40 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-800'}`}>
              <p className="text-[10px] uppercase font-black tracking-widest opacity-80 mb-1">AULAS AGRUPADAS NESTE DIA:</p>
              <p className="text-sm font-bold uppercase flex items-center gap-2">
                 {originalRecord.subject}
                 <span className="opacity-90 text-[10px] bg-indigo-500/20 font-black px-2 py-0.5 rounded">
                   {originalRecord.day} 
                 </span>
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                 {consecutiveSlots.map((s, idx) => (
                    <span key={idx} className="text-[9px] font-black bg-white/50 dark:bg-black/20 border border-indigo-500/30 px-2 py-1 rounded shadow-sm text-indigo-700 dark:text-indigo-300">
                       {s.time}
                    </span>
                 ))}
              </div>
           </div>

           <div className="space-y-3">
              <label className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                 Selecione os professores/disciplinas para quem deseja oferecer (Ou deixe aberto):
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <button 
                    onClick={() => setSelectedDiscipline('ALL')}
                    className={`flex flex-col items-start p-3 border rounded-xl transition-all text-left ${selectedDiscipline === 'ALL' ? (isDarkMode ? 'bg-indigo-600 border-indigo-500 shadow-md ring-2 ring-indigo-400 text-white' : 'bg-indigo-50 border-indigo-500 shadow-md ring-2 ring-indigo-400 text-indigo-900') : (isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-slate-500 text-slate-300' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600')}`}
                 >
                    <span className="font-black text-[11px] uppercase tracking-widest">Qualquer Professor</span>
                    <span className="text-[9px] opacity-80 mt-1">A aula ficará como Vaga Livre na Mastergrid</span>
                 </button>

                 {availableDisciplines.map(d => (
                    <button 
                      key={d.subject}
                      onClick={() => setSelectedDiscipline(d.subject)}
                      className={`flex flex-col items-start p-3 border rounded-xl transition-all text-left truncate ${selectedDiscipline === d.subject ? (isDarkMode ? 'bg-rose-600 border-rose-500 shadow-md ring-2 ring-rose-400 text-white' : 'bg-rose-50 border-rose-500 shadow-md ring-2 ring-rose-400 text-rose-900') : (isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-slate-500 text-slate-300' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600')}`}
                    >
                       <span className="font-black text-[11px] uppercase tracking-widest truncate">{d.subject}</span>
                       <span className="text-[9px] opacity-80 mt-1 truncate">Prof: {resolveTeacherName(d.teacher, globalTeachers)}</span>
                    </button>
                 ))}
              </div>
           </div>
        </div>

        {/* FOOTER ACTION */}
        <div className={`p-6 border-t flex flex-col md:flex-row items-center justify-between gap-4 ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
           {errorMsg ? <span className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-1.5"><AlertCircle size={16}/> {errorMsg}</span> : <div/>}
           <div className="flex gap-3 w-full md:w-auto mt-2 md:mt-0">
             <button onClick={onClose} className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${isDarkMode ? 'hover:bg-slate-700 text-slate-300 border border-slate-700' : 'hover:bg-slate-200 text-slate-600 border border-slate-200'}`}>
                Cancelar
             </button>
             <button 
               onClick={handleSubmit} 
               disabled={isSubmitting}
               className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all focus:outline-none focus:ring-4 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
             >
                {isSubmitting ? <span className="animate-pulse">Enviando...</span> : <><Send size={16}/> Disponibilizar Aulas</>}
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}
