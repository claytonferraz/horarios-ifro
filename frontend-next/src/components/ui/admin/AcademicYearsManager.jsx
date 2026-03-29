import React, { useState, useMemo } from 'react';
import { CalendarDays, Plus, Trash2, X, TrendingUp } from 'lucide-react';
import { InlineInput } from '../InlineInput';
import { apiClient } from '@/lib/apiClient';

const DAY_MAP = {
  'Domingo': 0, 'Segunda-feira': 1, 'Terça-feira': 2,
  'Quarta-feira': 3, 'Quinta-feira': 4, 'Sexta-feira': 5, 'Sábado': 6,
};
const DEFAULT_ACTIVE_DAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];

function countRangeUpToToday(startStr, endStr, activeDays) {
  if (!startStr || !endStr) return 0;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const daysToUse = activeDays && activeDays.length > 0 ? activeDays : DEFAULT_ACTIVE_DAYS;
  const activeDOW = new Set(daysToUse.map(d => DAY_MAP[d]).filter(v => v !== undefined));
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const end = new Date(Math.min(new Date(ey, em - 1, ed), today));
  let count = 0;
  while (cur <= end) {
    if (activeDOW.has(cur.getDay())) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function AcademicYearsManager({ isDarkMode, academicYearsMeta, uniqueYearsData, loadAdminMetadata, academicWeeks, activeDays }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());
  const [newTotalDays, setNewTotalDays] = useState('200');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const [importFrom, setImportFrom] = useState('');
  const [importOps, setImportOps] = useState({ days: true, times: true, bimesters: true, default: true });

  // Merge years from the DB meta and from imported schedules, sort descending
  const dbYears = Object.keys(academicYearsMeta || {});
  const scheduleYears = uniqueYearsData || [];
  const allYears = [...new Set([...dbYears.map(String), ...scheduleYears.map(String)])].sort((a, b) => Number(b) - Number(a));

  const handleAddYear = async () => {
    const yr = newYear.trim();
    if (!yr || isNaN(Number(yr))) return;
    setSaving(true);
    try {
      await apiClient.saveAcademicYearMeta(yr, { totalDays: newTotalDays || '', currentDays: '' });
      if (importFrom) {
        await apiClient.importConfig(importFrom, yr, importOps);
      }
      await loadAdminMetadata();
      setIsAdding(false);
      setNewYear(new Date().getFullYear().toString());
      setNewTotalDays('200');
      setImportFrom('');
      setImportOps({ days: true, times: true, bimesters: true, default: true });
    } catch (err) {
      alert("Erro: " + err.message);
    } finally { setSaving(false); }
  };

  const handleDeleteYear = async (year) => {
    if (!confirm(`Deseja remover o Ano Letivo ${year}? Isso não apaga as semanas vinculadas a ele.`)) return;
    setDeleting(year);
    try {
      // Saving with null values essentially removes the record on some backends.
      // We use totalDays '' and currentDays '' as a "clear" action.
      await apiClient.saveAcademicYearMeta(year, { totalDays: null, currentDays: null });
      await loadAdminMetadata();
    } finally { setDeleting(null); }
  };

  const inputClass = `w-full p-2.5 text-sm font-bold rounded-lg border focus:ring-2 focus:ring-emerald-500 outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`;

  return (
    <div className={`rounded-2xl shadow-sm border overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className={`text-white px-6 py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 border-slate-800'}`}>
        <div className="flex items-center gap-3">
          <CalendarDays size={18} className="text-emerald-400" />
          <h2 className="font-black text-xs uppercase tracking-[0.2em]">Controle do Ano Letivo</h2>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm hover:scale-105"
          >
            <Plus size={14} /> Novo Ano Letivo
          </button>
        )}
      </div>

      <div className="p-6">
        {/* Add year form */}
        {isAdding && (
          <div className={`p-5 rounded-2xl border mb-6 animate-in slide-in-from-top-2 ${isDarkMode ? 'bg-slate-900/50 border-emerald-700/50' : 'bg-emerald-50/50 border-emerald-200'}`}>
            <h3 className="font-black uppercase tracking-widest text-xs opacity-60 mb-4 pb-2 border-b border-dashed border-emerald-500/30">Novo Cadastro</h3>
            <div className="flex flex-wrap items-end gap-4 mb-5">
              <div>
                <label className="text-[10px] uppercase font-black opacity-60 block mb-1">Ano (ex: 2026)</label>
                <input
                  type="number"
                  value={newYear}
                  onChange={e => setNewYear(e.target.value)}
                  placeholder="2026"
                  className={`w-32 p-2.5 text-sm font-bold rounded-lg border focus:ring-2 focus:ring-emerald-500 outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black opacity-60 block mb-1">Meta de Dias Letivos</label>
                <input
                  type="number"
                  value={newTotalDays}
                  onChange={e => setNewTotalDays(e.target.value)}
                  placeholder="200"
                  className={`w-36 p-2.5 text-sm font-bold rounded-lg border focus:ring-2 focus:ring-emerald-500 outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                />
              </div>
            </div>

            {/* Import settings section */}
            {allYears.length > 0 && (
              <div className={`mb-6 p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                <label className="text-[10px] uppercase font-black opacity-60 block mb-3">Importar configurações de base de outro Ano Letivo (Opcional)</label>
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <select
                    value={importFrom}
                    onChange={e => setImportFrom(e.target.value)}
                    className={`p-2.5 text-sm font-bold rounded-lg border focus:ring-2 focus:ring-emerald-500 outline-none min-w-[200px] ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                  >
                    <option value="">-- Não importar (Em branco) --</option>
                    {allYears.filter(y => y !== newYear).map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  
                  {importFrom && (
                    <div className="flex flex-wrap gap-2 md:gap-4 items-center border-l border-dashed border-emerald-500/30 pl-4">
                      {Object.entries({ days: 'Dias da Semana', times: 'Horários / Turnos', bimesters: 'Bimestres', default: 'Horário Padrão' }).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-1.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={importOps[key]}
                            onChange={e => setImportOps({...importOps, [key]: e.target.checked})}
                            className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300"
                          />
                          <span className="text-[10px] uppercase font-black tracking-widest opacity-70 group-hover:opacity-100 transition-opacity">{label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-4 border-t border-emerald-500/20">
              <button
                onClick={handleAddYear}
                disabled={saving}
                className={`px-6 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest text-white transition-all shadow-md bg-emerald-600 hover:bg-emerald-700 ${saving ? 'opacity-50' : ''}`}
              >
                {saving ? 'Registrando…' : 'Finalizar Cadastro'}
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className={`p-2.5 rounded-lg border transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'}`}
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Year cards grid */}
        {allYears.length === 0 ? (
          <div className="py-12 text-center opacity-50">
            <CalendarDays size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-black text-sm uppercase tracking-widest">Nenhum ano letivo cadastrado</p>
            <p className="text-xs mt-1">Clique em "Novo Ano Letivo" no cabeçalho para começar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allYears.map((year, idx) => {
              const meta = academicYearsMeta[year] || { totalDays: '' };
              const isFromDB = !!academicYearsMeta[year];

              // Compute days up to today automatically from academic weeks
              const weeksForYear = (academicWeeks || []).filter(w => (w.academic_year || '2026') === year);
              const currentDaysCalc = weeksForYear.reduce((acc, w) => {
                return acc + countRangeUpToToday(w.start_date, w.end_date, activeDays);
              }, 0);

              const pct = meta.totalDays ? Math.min(100, Math.round((currentDaysCalc / Number(meta.totalDays)) * 100)) : 0;

              return (
                <div key={`${year}-${idx}`} className={`p-5 rounded-2xl border shadow-sm relative ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  {/* Year header */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Ano Letivo {year}</h3>
                    {isFromDB && (
                      <button
                        onClick={() => handleDeleteYear(year)}
                        disabled={deleting === year}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Remover ano letivo"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Meta de dias (editable) */}
                    <div className="flex flex-col gap-1.5">
                      <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Total de Dias Letivos (Meta)
                      </label>
                      <InlineInput
                        isDarkMode={isDarkMode}
                        value={meta.totalDays}
                        placeholder="Ex: 200"
                        onSave={val =>
                          apiClient.saveAcademicYearMeta(year, { totalDays: val, currentDays: meta.currentDays }).then(loadAdminMetadata)
                        }
                      />
                    </div>

                    {/* Dias letivos até hoje — calculado automaticamente */}
                    <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <label className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          <TrendingUp size={10} /> Dias Letivos Até Hoje
                        </label>
                        <span className={`text-xs font-black ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                          {pct}%
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{currentDaysCalc}</span>
                        {meta.totalDays && <span className={`text-xs font-bold opacity-50`}>/ {meta.totalDays} dias</span>}
                      </div>
                      {/* Progress bar */}
                      {meta.totalDays && (
                        <div className={`mt-2 w-full h-1.5 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}>
                          <div
                            className="h-1.5 rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                      <p className={`text-[9px] font-bold uppercase tracking-widest opacity-40 mt-1.5`}>Calculado das semanas cadastradas</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
