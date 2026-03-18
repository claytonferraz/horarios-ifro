import React, { useState, useEffect, useMemo } from 'react';
import { Save, Plus, Trash2, Clock, Calendar, AlertCircle, List, Settings, Check, Download } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { apiClient } from '@/lib/apiClient';
import { AcademicWeeksPanel } from './AcademicWeeksPanel';

const SHIFT_ORDER = { 'Matutino': 0, 'Vespertino': 1, 'Noturno': 2 };
const SHIFTS = ['Matutino', 'Vespertino', 'Noturno'];
const ALL_DAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const TABS = [
  { id: 'days', label: 'Dias da Semana', icon: Calendar },
  { id: 'times', label: 'Horários & Turnos', icon: Clock },
  { id: 'bimesters', label: 'Bimestres', icon: Calendar },
  { id: 'weeks', label: 'Semanas Acadêmicas', icon: Calendar },
  { id: 'default', label: 'Horário Padrão', icon: List }
];

function sortTimes(times) {
  return [...times].sort((a, b) => {
    const shiftDiff = (SHIFT_ORDER[a.shift] ?? 99) - (SHIFT_ORDER[b.shift] ?? 99);
    if (shiftDiff !== 0) return shiftDiff;
    return (a.timeStr || '').localeCompare(b.timeStr || '');
  });
}

export function ScheduleConfigPanel({ isDarkMode }) {
  const {
    activeDays, setActiveDays,
    classTimes, setClassTimes,
    bimesters, setBimesters,
    intervals, setIntervals,
    activeDefaultScheduleId, setActiveDefaultScheduleId,
    rawData, refreshData, setErrorMsg,
    selectedConfigYear, setSelectedConfigYear,
    academicYearsMeta
  } = useData();

  const [activeTab, setActiveTab] = useState('days');

  // Track local states for editing
  const [localDays, setLocalDays] = useState([]);
  const [localTimes, setLocalTimes] = useState([]);
  const [localBimesters, setLocalBimesters] = useState([]);
  const [localIntervals, setLocalIntervals] = useState([]);
  const [localDefaultId, setLocalDefaultId] = useState('');

  // Sync state whenever the contextual data from useData changes (trigger by year switch)
  useEffect(() => {
    setLocalDays(activeDays || ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira']);
    setLocalTimes(classTimes || []);
    setLocalBimesters(bimesters || []);
    setLocalIntervals(intervals || []);
    setLocalDefaultId(activeDefaultScheduleId || '');
  }, [activeDays, classTimes, bimesters, intervals, activeDefaultScheduleId, selectedConfigYear]);

  const [savingSection, setSavingSection] = useState(null);
  const [savedSection, setSavedSection] = useState(null);
  const [importingFromYear, setImportingFromYear] = useState('');

  const flashSaved = (section) => {
    setSavedSection(section);
    setTimeout(() => setSavedSection(null), 2000);
  };

  const yearsList = useMemo(() =>
    Object.keys(academicYearsMeta || {}).sort((a, b) => Number(b) - Number(a)),
    [academicYearsMeta]
  );
  
  // Calculate if the current year has an entirely blank/customizable configuration
  const isConfigEmpty = !classTimes && !bimesters;

  // ── Import Previous ───────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!importingFromYear) return;
    setSavingSection('import');
    try {
      await apiClient.importConfig(importingFromYear, selectedConfigYear);
      await refreshData();
      flashSaved('import');
      setImportingFromYear('');
    } catch (e) { setErrorMsg(`Falha na Importação: ${e.message}`); }
    finally { setSavingSection(null); }
  };

  // ── Days ──────────────────────────────────────────────────────────────────
  const toggleDay = (day) =>
    setLocalDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  const saveDays = async () => {
    setSavingSection('days');
    try {
      await apiClient.updateConfig({ year: selectedConfigYear, activeDays: localDays, classTimes, bimesters, intervals, activeDefaultScheduleId });
      setActiveDays(localDays);
      flashSaved('days');
    } catch (e) { setErrorMsg(`Falha: ${e.message}`); }
    finally { setSavingSection(null); }
  };

  // ── Times & Intervals ───────────────────────────────────────────────────────
  const addTime = () =>
    setLocalTimes(prev => [...prev, { id: Date.now().toString(), timeStr: '00:00 - 00:00', shift: 'Matutino' }]);
    
  const updateTime = (id, field, value) =>
    setLocalTimes(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));

  const removeTime = (id) =>
    setLocalTimes(prev => prev.filter(t => t.id !== id));

  const addInterval = () =>
    setLocalIntervals(prev => [...prev, { id: 'i_' + Date.now(), shift: 'Matutino', position: 3, duration: 20, description: 'Intervalo/Lanche' }]);

  const updateInterval = (id, field, value) =>
    setLocalIntervals(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));

  const removeInterval = (id) =>
    setLocalIntervals(prev => prev.filter(i => i.id !== id));

  const saveTimesAndIntervals = async () => {
    setSavingSection('times');
    const sorted = sortTimes(localTimes);
    try {
      await apiClient.updateConfig({ year: selectedConfigYear, activeDays, classTimes: sorted, bimesters, intervals: localIntervals, activeDefaultScheduleId });
      setLocalTimes(sorted);
      setClassTimes(sorted);
      setIntervals(localIntervals);
      flashSaved('times');
    } catch (e) { setErrorMsg(`Falha: ${e.message}`); }
    finally { setSavingSection(null); }
  };

  // ── Bimesters ─────────────────────────────────────────────────────────────
  const addBimester = () => {
    const n = localBimesters.length + 1;
    setLocalBimesters(prev => [...prev, { id: Date.now().toString(), name: `${n}º Bimestre`, startDate: '', endDate: '' }]);
  };

  const updateBimester = (id, field, value) =>
    setLocalBimesters(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));

  const removeBimester = (id) =>
    setLocalBimesters(prev => prev.filter(b => b.id !== id));

  const saveBimesters = async () => {
    setSavingSection('bimesters');
    try {
      await apiClient.updateConfig({ year: selectedConfigYear, activeDays, classTimes, bimesters: localBimesters, intervals, activeDefaultScheduleId });
      setBimesters(localBimesters);
      flashSaved('bimesters');
    } catch (e) { setErrorMsg(`Falha: ${e.message}`); }
    finally { setSavingSection(null); }
  };

  // ── Default schedule ──────────────────────────────────────────────────────
  const saveDefault = async () => {
    setSavingSection('default');
    try {
      await apiClient.updateConfig({ year: selectedConfigYear, activeDays, classTimes, bimesters, activeDefaultScheduleId: localDefaultId || null });
      setActiveDefaultScheduleId(localDefaultId);
      flashSaved('default');
    } catch (e) { setErrorMsg(`Falha: ${e.message}`); }
    finally { setSavingSection(null); }
  };

  const padraoList = Array.from(new Set(rawData.filter(r => r.type === 'padrao').map(r => r.week)));

  const groupedTimes = SHIFTS.reduce((acc, s) => {
    const items = localTimes.filter(t => t.shift === s);
    if (items.length) acc[s] = items;
    return acc;
  }, {});

  const SaveBtn = ({ section, onClick }) => {
    const isThis = savingSection === section;
    const wasSaved = savedSection === section;
    return (
      <button
        onClick={onClick}
        disabled={!!savingSection}
        className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-1.5 shadow transition-all active:scale-95 ${
          wasSaved
            ? 'bg-emerald-600 text-white'
            : isThis
            ? 'opacity-50 cursor-not-allowed bg-blue-600 text-white'
            : isDarkMode
            ? 'bg-blue-600 hover:bg-blue-500 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {wasSaved ? <><Check size={14}/> Salvo!</> : isThis ? 'Salvando…' : <><Save size={14}/> Salvar</>}
      </button>
    );
  };

  return (
    <div className={`p-6 rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
      <div className="mb-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
            <Settings className="text-blue-500" /> Configuração de Horários
          </h2>
          <p className="text-sm opacity-60 mt-1 font-medium">Defina dias letivos, estrutura de turnos e fechamentos de bimestres.</p>
        </div>
        
        {/* Year Selector Context Switcher */}
        <div className={`p-3 rounded-2xl flex items-center gap-3 shadow-sm border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <label className="text-[10px] uppercase font-black tracking-widest opacity-60 ml-2">Contexto Letivo:</label>
          <select
            value={selectedConfigYear}
            onChange={e => setSelectedConfigYear(e.target.value)}
            className={`text-base font-black px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
          >
            {yearsList.map(y => <option key={y} value={y}>{y}</option>)}
            {!yearsList.includes(selectedConfigYear) && <option value={selectedConfigYear}>{selectedConfigYear}</option>}
          </select>
        </div>
      </div>

      {isConfigEmpty && (
        <div className={`mb-6 p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 ${isDarkMode ? 'bg-blue-900/20 border-blue-900/50' : 'bg-blue-50 border-blue-100'}`}>
          <div className="flex items-center gap-3">
             <Download size={24} className="text-blue-500" />
             <div>
               <p className="font-bold text-sm">Este ano letivo ({selectedConfigYear}) ainda não possui configurações.</p>
               <p className="text-xs opacity-70">Você pode partir do zero ou importar configurações (Turnos, Bimestres) de outro ano.</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={importingFromYear}
              onChange={e => setImportingFromYear(e.target.value)}
              className={`text-xs font-bold px-3 py-2 rounded-lg border focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}
            >
              <option value="">-- Importar de --</option>
              {yearsList.filter(y => y !== selectedConfigYear).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={handleImport}
              disabled={!importingFromYear || savingSection === 'import'}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest rounded-lg disabled:opacity-50 transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className={`flex items-center gap-2 mb-6 p-1.5 rounded-xl border overflow-x-auto hide-scrollbar ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                isActive 
                  ? (isDarkMode ? 'bg-slate-800 text-blue-400 shadow-sm' : 'bg-white text-blue-600 shadow-sm')
                  : (isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')
              }`}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content Area */}
      <div className="mt-4">
        
        {/* --- DIAS DA SEMANA --- */}
        {activeTab === 'days' && (
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 opacity-70">
                <Calendar size={16}/> Dias da semana de aulas ({selectedConfigYear})
              </h3>
              <SaveBtn section="days" onClick={saveDays} />
            </div>
            <div className="flex flex-wrap gap-3">
              {ALL_DAYS.map(day => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`px-6 py-3 text-sm font-bold rounded-xl border transition-all ${
                    localDays.includes(day)
                      ? isDarkMode ? 'bg-blue-900/40 border-blue-500 text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'bg-blue-100 border-blue-500 text-blue-800 shadow-sm'
                      : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            <p className="text-xs mt-4 opacity-50 italic">* Dias marcados aparecerão nas tabelas do portal do aluno e professor.</p>
          </div>
        )}

        {/* --- HORÁRIOS & TURNOS --- */}
        {activeTab === 'times' && (
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 opacity-70">
                <Clock size={16}/> Tempos de Aula ({selectedConfigYear})
              </h3>
              <div className="flex items-center gap-3">
                <button onClick={addTime} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`}>
                  <Plus size={14}/> Adicionar Horário
                </button>
                <SaveBtn section="times" onClick={saveTimesAndIntervals} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Clock size={12}/> Slots de Aula</h4>
                {localTimes.map((item, i) => (
                  <div key={item.id} className={`flex flex-wrap items-center gap-2 p-3 rounded-xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-black/5 dark:bg-black/20 text-xs font-black opacity-60 shrink-0">{i + 1}</div>
                    <input
                      type="text"
                      value={item.timeStr || ''}
                      onChange={e => updateTime(item.id, 'timeStr', e.target.value)}
                      placeholder="07:30 - 08:20"
                      className={`w-32 text-sm font-bold bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 ${isDarkMode ? 'text-slate-200 placeholder-slate-600' : 'text-slate-700 placeholder-slate-400'}`}
                    />
                    <select
                      value={item.shift}
                      onChange={e => updateTime(item.id, 'shift', e.target.value)}
                      className={`text-[10px] font-bold rounded-lg border-none focus:ring-1 focus:ring-blue-500 px-2 py-1.5 ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-700 shadow-sm'}`}
                    >
                      {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={() => removeTime(item.id)} className="ml-auto p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={16}/></button>
                  </div>
                ))}
                {localTimes.length === 0 && <p className="text-sm opacity-50 italic py-4 text-center">Nenhum horário cadastrado. Adicione tempos de aula para começar.</p>}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2"><Clock size={12}/> Intervalos</h4>
                  <button onClick={addInterval} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors ${isDarkMode ? 'bg-amber-900/30 text-amber-500 hover:bg-amber-900/50' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
                    <Plus size={12}/> Add Intervalo
                  </button>
                </div>
                {localIntervals.map((inv, i) => (
                  <div key={inv.id} className={`flex flex-col gap-2 p-3 rounded-xl border border-dashed ${isDarkMode ? 'bg-amber-900/10 border-amber-800/50' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex justify-between items-center text-xs font-black">
                       <input type="text" value={inv.description} onChange={e => updateInterval(inv.id, 'description', e.target.value)} className="bg-transparent border-b font-bold w-1/2 focus:outline-none text-amber-600 dark:text-amber-500" placeholder="Ex: Recreio" />
                       <button onClick={() => removeInterval(inv.id)} className="text-red-500 hover:opacity-70"><Trash2 size={14}/></button>
                    </div>
                    <div className="flex gap-2">
                      <select value={inv.shift} onChange={e => updateInterval(inv.id, 'shift', e.target.value)} className={`text-[10px] font-bold rounded-md px-1 py-1 flex-1 ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}`}>
                        {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="font-bold opacity-70">Após a aula: </span>
                      <input type="number" min="1" max="10" value={inv.position} onChange={e => updateInterval(inv.id, 'position', e.target.value)} className={`w-12 text-center rounded px-1 py-1 font-black ${isDarkMode?'bg-slate-900 text-slate-200':'bg-white border'}`} />
                      <span className="font-bold border-l pl-2 opacity-70">Duração (min): </span>
                      <input type="number" min="5" max="120" value={inv.duration} onChange={e => updateInterval(inv.id, 'duration', e.target.value)} className={`w-14 text-center rounded px-1 py-1 font-black text-amber-600 ${isDarkMode?'bg-slate-900':'bg-white border'}`} />
                    </div>
                  </div>
                ))}
                {localIntervals.length === 0 && <p className="text-[10px] font-bold opacity-50 italic py-2 text-center">Nenhum intervalo cadastrado.</p>}
              </div>

            </div>

            <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <p className="font-black uppercase tracking-widest opacity-60 text-xs">Ações Práticas (Recalcular Horários em Cadeia)</p>
              </div>
              <p className="text-xs mb-4 opacity-75 font-medium">Ao clicar em um turno, o sistema usará a hora/minuto da <span className="font-bold text-amber-500">1ª aula</span> atual, e recalculará as demais com base em aulas de 50 minutos + a duração dos intervalos configurados.</p>
              <div className="flex gap-3">
                 {SHIFTS.map(shift => (
                   <button 
                     key={shift}
                     onClick={() => {
                        let timesForShift = localTimes.filter(t => t.shift === shift);
                        if(timesForShift.length === 0) return alert(`Adicione pelo menos 1 aula no turno ${shift}!`);
                        timesForShift.sort((a,b) => a.timeStr.localeCompare(b.timeStr));
                        const firstStr = timesForShift[0].timeStr.split('-')[0].trim();
                        let [hh, mm] = firstStr.split(':').map(Number);
                        if(isNaN(hh) || isNaN(mm)) return alert(`O horário da 1ª aula do turno ${shift} "${firstStr}" não está num formato válido (HH:MM).`);
                        let minutesCounter = hh * 60 + mm;
                        const intervalsForShift = localIntervals.filter(i => i.shift === shift);
                        const newTimes = [];
                        for(let i = 0; i < timesForShift.length; i++) {
                           const startHH = Math.floor(minutesCounter / 60).toString().padStart(2, '0');
                           const startMM = (minutesCounter % 60).toString().padStart(2, '0');
                           minutesCounter += 50; 
                           const endHH = Math.floor(minutesCounter / 60).toString().padStart(2, '0');
                           const endMM = (minutesCounter % 60).toString().padStart(2, '0');
                           newTimes.push({ ...timesForShift[i], timeStr: `${startHH}:${startMM} - ${endHH}:${endMM}` });
                           const interval = intervalsForShift.find(int => Number(int.position) === i + 1);
                           if (interval) minutesCounter += Number(interval.duration || 0);
                        }
                        setLocalTimes(prev => prev.map(pt => {
                            const updated = newTimes.find(nt => nt.id === pt.id);
                            return updated ? updated : pt;
                        }));
                     }}
                     className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest border transition-all hover:scale-[1.02] ${shift === 'Matutino' ? 'text-amber-500 border-amber-500/30 hover:bg-amber-500/10' : shift === 'Vespertino' ? 'text-blue-500 border-blue-500/30 hover:bg-blue-500/10' : 'text-violet-500 border-violet-500/30 hover:bg-violet-500/10'}`}
                   >
                     Recalcular {shift}
                   </button>
                 ))}
              </div>
            </div>
          </div>
        )}

        {/* --- HORÁRIO PADRÃO --- */}
        {activeTab === 'default' && (
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-2">
             <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 opacity-70">
                <List size={16}/> Horário Base (Padrão) de {selectedConfigYear}
              </h3>
              <SaveBtn section="default" onClick={saveDefault} />
            </div>
            <div className={`p-6 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-blue-900/10 border-blue-900/30' : 'bg-blue-50/50 border-blue-100'}`}>
              <p className="text-sm mb-4 font-medium opacity-80 leading-relaxed">Selecione qual grade de horário "Padrão" enviada pelo FET o sistema deve assumir como base fundamental. O sistema usará essa base para preencher os nomes das turmas nas estatísticas e painéis de conflitos.</p>
              
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-widest font-black opacity-60 ml-1">Semana Padrão Cadastrada</label>
                <select
                  value={localDefaultId}
                  onChange={e => setLocalDefaultId(e.target.value)}
                  className={`w-full p-4 font-bold text-sm rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white shadow-inner' : 'bg-white border-slate-200 text-slate-800 shadow-sm'}`}
                >
                  <option value="">-- Nenhum Horário Padrão Selecionado --</option>
                  {padraoList.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {padraoList.length === 0 && (
                <div className={`mt-4 p-4 rounded-xl flex items-start gap-3 ${isDarkMode ? 'bg-amber-900/20 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <p className="text-xs font-medium leading-relaxed">Você ainda não enviou nenhuma grade oficial do tipo <strong>"PADRAO"</strong> ao sistema. Vá até a aba "Efetivar Novo Horário FET" e faça upload da planilha base contendo todas as turmas para que as opções apareçam aqui.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- BIMESTRES --- */}
        {activeTab === 'bimesters' && (
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 opacity-70">
                <Calendar size={16}/> Recortes de Bimestres ({selectedConfigYear})
              </h3>
              <div className="flex items-center gap-3">
                <button onClick={addBimester} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`}>
                  <Plus size={14}/> Adicionar Recorte
                </button>
                <SaveBtn section="bimesters" onClick={saveBimesters} />
              </div>
            </div>

            <div className="space-y-4">
              {localBimesters.map((item) => (
                <div key={item.id} className={`p-5 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <label className="text-[10px] uppercase tracking-widest font-black opacity-60 ml-1 block mb-1.5">Descrição do Recorte</label>
                      <input
                        type="text"
                        value={item.name || ''}
                        onChange={e => updateBimester(item.id, 'name', e.target.value)}
                        placeholder="Ex: 1º Bimestre"
                        className={`w-full text-base font-black bg-transparent border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 px-4 py-3 ${isDarkMode ? 'border-slate-700 text-slate-200' : 'border-slate-300 text-slate-800 bg-white'}`}
                      />
                    </div>
                    <div className="flex gap-4">
                       <div className="flex-1 min-w-[130px]">
                        <label className="text-[10px] uppercase tracking-widest font-black opacity-60 ml-1 block mb-1.5">Data Início</label>
                        <input
                          type="date"
                          value={item.startDate || ''}
                          onChange={e => updateBimester(item.id, 'startDate', e.target.value)}
                          className={`w-full text-sm font-bold border rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-700'}`}
                        />
                      </div>
                      <div className="flex-1 min-w-[130px]">
                        <label className="text-[10px] uppercase tracking-widest font-black opacity-60 ml-1 block mb-1.5">Data Encerramento</label>
                        <input
                          type="date"
                          value={item.endDate || ''}
                          onChange={e => updateBimester(item.id, 'endDate', e.target.value)}
                          className={`w-full text-sm font-bold border rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-700'}`}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end mt-4 pt-4 border-t border-dashed border-slate-400/30">
                    <button onClick={() => removeBimester(item.id)} className="px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-1.5">
                      <Trash2 size={14}/> Excluir
                    </button>
                  </div>
                </div>
              ))}
              {localBimesters.length === 0 && (
                <div className="py-12 text-center opacity-50 border-2 border-dashed rounded-2xl border-slate-400">
                   <Calendar size={32} className="mx-auto mb-3 opacity-30" />
                   <p className="text-sm font-bold uppercase tracking-widest">Nenhum recorte configurado</p>
                   <p className="text-xs mt-1">Adicione os bimestres para permitir consolidação por fase no painel da Gestão.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- SEMANAS ACADÊMICAS --- */}
        {activeTab === 'weeks' && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <AcademicWeeksPanel isDarkMode={isDarkMode} />
          </div>
        )}

      </div>
    </div>
  );
}
