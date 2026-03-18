import React, { useState } from 'react';
import { X, Send, AlertCircle, RefreshCcw } from 'lucide-react';
import { resolveTeacherName } from '@/lib/dates';

// Utility for hashing subject string into a consistent color pair (extracted from PortalView optionally or replicated)
const COLORS = [
  { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200', bgDark: 'bg-emerald-900/30', textDark: 'text-emerald-300', borderDark: 'border-emerald-800/50' },
  { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200', bgDark: 'bg-indigo-900/30', textDark: 'text-indigo-300', borderDark: 'border-indigo-800/50' },
  { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200', bgDark: 'bg-rose-900/30', textDark: 'text-rose-300', borderDark: 'border-rose-800/50' },
  { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200', bgDark: 'bg-amber-900/30', textDark: 'text-amber-300', borderDark: 'border-amber-800/50' },
  { bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-200', bgDark: 'bg-sky-900/30', textDark: 'text-sky-300', borderDark: 'border-sky-800/50' },
  { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200', bgDark: 'bg-violet-900/30', textDark: 'text-violet-300', borderDark: 'border-violet-800/50' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800', border: 'border-fuchsia-200', bgDark: 'bg-fuchsia-900/30', textDark: 'text-fuchsia-300', borderDark: 'border-fuchsia-800/50' }
];

function getColorHash(str, isDark) {
  if (!str) return isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700';
  const c = COLORS[Math.abs(str.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)) % COLORS.length];
  return isDark ? `${c.bgDark} ${c.borderDark} ${c.textDark}` : `${c.bg} ${c.border} ${c.text}`;
}

export function TeacherExchangeModal({
  isOpen, onClose, isDarkMode, 
  originalRecord, targetClass, classRecords = [], 
  safeDays = [], safeTimes = [], globalTeachers = [],
  apiClient, selectedWeek
}) {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [classType, setClassType] = useState('Regular');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !originalRecord) return null;

  const handleSlotClick = (day, time, recordsInSlot) => {
    // Cannot select own slot
    if (day === originalRecord.day && time === originalRecord.time) return;
    
    setSelectedSlot({
      day, time,
      isEmpty: recordsInSlot.length === 0,
      existingRecord: recordsInSlot.length > 0 ? recordsInSlot[0] : null
    });
    setErrorMsg('');
  };

  const handleSubmit = async () => {
    if (!selectedSlot) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const proposalInfo = selectedSlot.isEmpty 
          ? `Aula Vaga (${selectedSlot.day} - ${selectedSlot.time})` 
          : `Troca com ${selectedSlot.existingRecord.subject} (${resolveTeacherName(selectedSlot.existingRecord.teacher, globalTeachers)}) - ${selectedSlot.day} - ${selectedSlot.time}`;

      await apiClient.submitRequest({
        siape: originalRecord.teacher,
        week_id: selectedWeek,
        description: `Proposta de Troca / Ocupação de Vaga gerada pelo Portal. Tipo de Aula preterida: ${classType}`,
        original_slot: `${originalRecord.day} - ${originalRecord.time} - ${targetClass} (${originalRecord.subject})`,
        proposed_day: selectedSlot.day,
        proposed_time: selectedSlot.time,
        proposed_type: classType,
        proposed_details: proposalInfo
      });
      alert('Solicitação enviada com sucesso ao DAPE!');
      onClose();
    } catch (e) {
      setErrorMsg(e.message || 'Erro ao submeter a intenção.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex justify-center items-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-6xl rounded-2xl shadow-xl border overflow-hidden flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        
        {/* HEADER */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
           <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-500/20 text-indigo-500 rounded-lg">
                <RefreshCcw size={20} />
             </div>
             <div>
                <h3 className={`font-black text-sm uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  Portal de Solicitação de Troca
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                  Turma Alvo: {targetClass} ({selectedWeek})
                </p>
             </div>
           </div>
           <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}>
             <X size={20}/>
           </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
           <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm ${isDarkMode ? 'bg-indigo-900/20 border-indigo-800/40 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-800'}`}>
               <div>
                  <p className="text-[10px] uppercase font-black tracking-widest opacity-80 mb-1">AULA DE ORIGEM (Sua)</p>
                  <p className="text-sm font-bold uppercase">{originalRecord.subject} <span className="opacity-70 text-[10px] bg-indigo-500/10 px-1 py-0.5 rounded">({originalRecord.day} - {originalRecord.time})</span></p>
               </div>
               <div className="hidden md:block text-2xl opacity-50">→</div>
               <div>
                  <p className="text-[10px] uppercase font-black tracking-widest opacity-80 mb-1">HORÁRIO PROPOSTO (Clique na grade abaixo)</p>
                  <p className="text-sm font-bold uppercase text-rose-500 flex items-center gap-2">
                     {selectedSlot ? (
                       <>
                         <span>{selectedSlot.day}</span>
                         <span className="opacity-70 text-[10px] bg-rose-500/10 text-rose-600 px-1 py-0.5 rounded">({selectedSlot.time})</span>
                         <span className={`text-[10px] font-black tracking-widest px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-rose-900/40 text-rose-400' : 'bg-rose-100 text-rose-700'}`}>{selectedSlot.isEmpty ? 'AULA VAGA' : `TROCA COM ${selectedSlot.existingRecord.subject}`}</span>
                       </>
                     ) : 'SELECIONE UM BLOCO >'}
                  </p>
               </div>
           </div>

           {/* Opções adicionais se selecionou */}
           {selectedSlot && (
              <div className="animate-in fade-in slide-in-from-top-2 p-4 border rounded-xl space-y-3 bg-rose-500/10 border-rose-500/30">
                 <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>
                   Defina o Ciclo de Vida (Tipo) da Aula Solicitada:
                 </label>
                 <div className="flex flex-wrap gap-2">
                   {['Regular', 'Recuperação', 'Exame', 'Atendimento'].map(t => (
                      <button 
                        key={t}
                        onClick={() => setClassType(t)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${classType === t ? (isDarkMode ? 'bg-rose-500 text-white shadow-md' : 'bg-rose-600 text-white shadow-md') : (isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 flex items-center gap-1.5 border border-slate-700' : 'bg-white text-slate-500 hover:bg-slate-100 flex items-center gap-1.5 border border-slate-200')}`}
                      >
                         {t} {t === 'Regular' && <span className="opacity-70 lowercase">(-40h)</span>}
                      </button>
                   ))}
                 </div>
                 {classType !== 'Regular' && <p className="text-[10px] flex items-center gap-1.5 font-bold text-amber-500 uppercase tracking-widest mt-2 bg-amber-500/10 p-2 rounded border border-amber-500/20"><AlertCircle size={14}/> <span>Somente aulas marcadas como 'Regular' alimentam a Carga Horária base da matriz de 40h. As demais representam intenções pedagógicas.</span></p>}
              </div>
           )}

           {/* Grade Isolada */}
           <div className="overflow-x-auto w-full pt-2 custom-scrollbar pb-2">
             <table className="w-full border-collapse relative text-xs">
                <thead>
                  <tr className={`border-b text-[9px] font-black uppercase tracking-widest text-slate-400 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <th className={`sticky left-0 z-30 py-3 px-2 border-r-[3px] w-20 min-w-[80px] text-center shadow-[2px_0_5px_rgba(0,0,0,0.05)] ${isDarkMode ? 'bg-slate-900 border-slate-700 shadow-black' : 'bg-slate-100 border-slate-300'}`}>Horário / Dia</th>
                    {safeTimes.map((tObj) => (
                      <th key={tObj.timeStr || tObj} className={`py-3 px-3 border-r-[3px] min-w-[150px] last:border-r-0 text-center ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-500'}`}>
                        {tObj.timeStr || tObj}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                  {safeDays.map((day) => {
                     return (
                        <tr key={`exc-${day}`} className="group transition-colors relative">
                           <td className={`sticky left-0 z-20 py-4 px-2 border-r-[3px] align-middle text-center shadow-[2px_0_5px_rgba(0,0,0,0.05)] ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 shadow-black' : 'bg-slate-50 border-slate-300 text-slate-600'}`}>
                             <span className="font-black text-[10px] uppercase tracking-widest" style={{ display: 'inline-block', transform: 'rotate(-90deg)', whiteSpace: 'nowrap', minHeight: '80px' }}>
                               {day.split('-')[0]}
                             </span>
                           </td>
                           {safeTimes.map(tObj => {
                              const timeStr = tObj.timeStr || tObj;
                              const recordsInSlot = classRecords.filter(r => r.day === day && r.time === timeStr);
                              const isOwn = day === originalRecord.day && timeStr === originalRecord.time;
                              const isSelected = selectedSlot?.day === day && selectedSlot?.time === timeStr;

                              return (
                                <td key={`exc-${day}-${timeStr}`} className={`p-1.5 border-r-[3px] last:border-r-0 align-top ${isSelected ? (isDarkMode ? 'bg-rose-900/10' : 'bg-rose-50/50') : isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}>
                                   <div 
                                      onClick={() => handleSlotClick(day, timeStr, recordsInSlot)}
                                      className={`w-full h-full min-h-[90px] flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border transition-all cursor-pointer ${
                                        isOwn ? (isDarkMode ? 'bg-slate-800/80 border-slate-600 text-slate-400 grayscale opacity-60 cursor-not-allowed' : 'bg-slate-100 border-slate-300 text-slate-400 grayscale opacity-60 cursor-not-allowed')
                                        : isSelected ? (isDarkMode ? 'bg-rose-600/20 border-rose-500 shadow-lg ring-2 ring-inner ring-rose-500 scale-[1.03] z-10' : 'bg-rose-50 border-rose-400 shadow-lg ring-2 ring-inner ring-rose-500 scale-[1.03] z-10 text-rose-800')
                                        : recordsInSlot.length === 0 ? (isDarkMode ? 'bg-slate-800/40 border-slate-700 border-dashed text-slate-600 hover:bg-slate-700/60 hover:border-slate-500' : 'bg-white border-slate-300 border-dashed text-slate-400 hover:bg-slate-50 hover:border-slate-400')
                                        : (isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-indigo-500 hover:shadow-md' : 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md')
                                      }`}
                                   >
                                      {isOwn ? (
                                        <>
                                           <span className="text-[10px] font-black uppercase tracking-widest text-center leading-tight">Foco da Troca</span>
                                           <span className="text-[8px] mt-2 bg-black/20 px-2 py-0.5 rounded-sm font-bold uppercase">SUA AULA</span>
                                        </>
                                      ) : Object.keys(recordsInSlot).length === 0 ? (
                                        <div className="flex flex-col items-center text-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                                           <span className="text-xl font-black mb-1 opacity-50">?</span>
                                           <span className="text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded outline outline-1 outline-current">Aula Vaga</span>
                                           <span className="text-[7px] uppercase tracking-widest mt-0.5 font-bold">Clique p/ Selecionar</span>
                                        </div>
                                      ) : (
                                        <>
                                          <p className={`font-black uppercase text-[10px] text-center leading-tight mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                             {recordsInSlot[0].subject}
                                          </p>
                                          <p className={`text-[9px] font-bold uppercase tracking-widest text-center ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                             {resolveTeacherName(recordsInSlot[0].teacher, globalTeachers)}
                                          </p>
                                          {recordsInSlot[0].room && <span className={`details text-[8px] font-black tracking-tighter opacity-70 px-1.5 py-0.5 rounded mt-2 w-fit uppercase mx-auto ${isDarkMode ? 'bg-white/10 text-white' : 'bg-black/5 text-slate-700'}`}>{recordsInSlot[0].room}</span>}
                                        </>
                                      )}
                                   </div>
                                </td>
                              );
                           })}
                        </tr>
                     );
                  })}
                </tbody>
             </table>
           </div>
        </div>

        {/* FOOTER ACTION */}
        <div className={`p-6 border-t flex flex-col md:flex-row items-center justify-between gap-4 ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
           {errorMsg ? <span className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-1.5 w-full md:w-auto"><AlertCircle size={16}/> {errorMsg}</span> : <span className="hidden md:block" />}
           <div className="flex gap-3 w-full md:w-auto mt-2 md:mt-0">
             <button onClick={onClose} className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${isDarkMode ? 'hover:bg-slate-700 text-slate-300 border border-slate-700' : 'hover:bg-slate-200 text-slate-600 hover:border-slate-300 border border-slate-200'}`}>
                Cancelar
             </button>
             <button 
               onClick={handleSubmit} 
               disabled={!selectedSlot || isSubmitting}
               className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50 active:scale-95 disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/30'}`}
             >
                {isSubmitting ? <span className="animate-pulse">Enviando Solicitação...</span> : <><Send size={16}/> Enviar Intenção de Troca / Ocupação</>}
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}
