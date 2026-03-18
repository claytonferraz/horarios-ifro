import React, { useState, useMemo } from 'react';
import { CalendarDays, Plus, Trash2, Edit3, X, Check, BookOpen } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { apiClient } from '@/lib/apiClient';

const CATEGORIES = [
  { value: 'regular',     label: 'Regular',     color: 'emerald' },
  { value: 'recuperacao', label: 'Recuperação',  color: 'amber' },
  { value: 'exame',       label: 'Exame',        color: 'rose' },
];

const CAT_STYLES = {
  regular:     { dark: 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400', light: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  recuperacao: { dark: 'bg-amber-900/30 border-amber-700/50 text-amber-400',      light: 'bg-amber-50 border-amber-200 text-amber-700' },
  exame:       { dark: 'bg-rose-900/30 border-rose-700/50 text-rose-400',         light: 'bg-rose-50 border-rose-200 text-rose-700' },
};

// Day-of-week names that match the `activeDays` config strings
const DAY_MAP = {
  'Domingo': 0, 'Segunda-feira': 1, 'Terça-feira': 2,
  'Quarta-feira': 3, 'Quinta-feira': 4, 'Sexta-feira': 5, 'Sábado': 6,
};

const DEFAULT_ACTIVE_DAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];

/** Counts school days (inclusive) between ISO date strings, only on activeDays. */
function countSchoolDays(startStr, endStr, activeDays) {
  if (!startStr || !endStr) return 0;
  const daysToUse = activeDays && activeDays.length > 0 ? activeDays : DEFAULT_ACTIVE_DAYS;
  const activeDOW = new Set(daysToUse.map(d => DAY_MAP[d]).filter(v => v !== undefined));
  let count = 0;
  // Parse dates using local time to avoid UTC offset issues
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  while (cur <= end) {
    if (activeDOW.has(cur.getDay())) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function CategoryBadge({ category, isDarkMode }) {
  const s = CAT_STYLES[category] || CAT_STYLES.regular;
  const label = CATEGORIES.find(c => c.value === category)?.label || category;
  return (
    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${isDarkMode ? s.dark : s.light}`}>
      {label}
    </span>
  );
}

const emptyForm = { name: '', start_date: '', end_date: '', category: 'regular', academic_year: '' };

export function AcademicWeeksPanel({ isDarkMode }) {
  const { academicWeeks, refreshData, setErrorMsg, activeDays, academicYearsMeta, selectedConfigYear } = useData();

  const [isEditing, setIsEditing] = useState(null);
  const [editForm, setEditForm]   = useState(emptyForm);
  const [isAdding, setIsAdding]   = useState(false);
  const [addForm, setAddForm]     = useState(emptyForm);
  const [isSaving, setIsSaving]   = useState(false);

  // All existing academic years from the meta object, sorted descending
  const yearsList = useMemo(() =>
    Object.keys(academicYearsMeta || {}).sort((a, b) => Number(b) - Number(a)),
    [academicYearsMeta]
  );
  const latestYear = yearsList[0] || '';

  // Total school days per academic year derived from the weeks
  const totalsByYear = useMemo(() => {
    const map = {};
    (academicWeeks || []).forEach(w => {
      const yr = w.academic_year || '2026';
      // Compute the days dynamically if it's falsy or 0
      const days = w.school_days ? w.school_days : countSchoolDays(w.start_date, w.end_date, activeDays);
      map[yr] = (map[yr] || 0) + days;
    });
    return map;
  }, [academicWeeks, activeDays]);

  const inputClass = `w-full p-2.5 text-sm font-bold rounded-lg border focus:ring-2 focus:ring-violet-500 outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`;
  const labelClass = 'text-[10px] uppercase font-black opacity-60 ml-1 mb-1 block';

  // Extract weeks specifically for the selectedConfigYear, grouped by category
  const activeYearWeeks = useMemo(() => {
    const map = { regular: [], recuperacao: [], exame: [] };
    (academicWeeks || []).forEach(w => {
      // If a week has no year assigned, assume 2026 as requested
      const yr = w.academic_year || '2026';
      if (yr === selectedConfigYear) {
         const cat = w.category || 'regular';
         if (!map[cat]) map[cat] = [];
         map[cat].push(w);
      }
    });
    return map;
  }, [academicWeeks, selectedConfigYear]);

  // Safe default for the "Add Form": force the `selectedConfigYear` context
  const defaultAddYear = selectedConfigYear || new Date().getFullYear().toString();

  const handleOpenAdd = () => {
    let maxNumber = 0;
    let maxDate = null;

    Object.values(activeYearWeeks).flat().forEach(w => {
       // Determine highest week number
       const match = w.name && w.name.match(/\d+/);
       if (match) {
         const num = parseInt(match[0], 10);
         if (num > maxNumber) maxNumber = num;
       }
       // Determine maximum end date
       if (w.end_date) {
         const d = new Date(w.end_date + 'T12:00:00');
         if (!maxDate || d > maxDate) maxDate = d;
       }
    });

    const nextNum = String(maxNumber + 1).padStart(2, '0');
    let start_date = '';
    let end_date = '';

    if (maxDate) {
      // Find the next Monday
      let nextMonday = new Date(maxDate);
      nextMonday.setDate(nextMonday.getDate() + 1);
      while (nextMonday.getDay() !== 1) { // 1 is Monday
        nextMonday.setDate(nextMonday.getDate() + 1);
      }
      start_date = nextMonday.toISOString().split('T')[0];

      // Default the end date to 4 days later (Friday)
      let nextFriday = new Date(nextMonday);
      nextFriday.setDate(nextFriday.getDate() + 4);
      end_date = nextFriday.toISOString().split('T')[0];
    }

    setAddForm({ 
      ...emptyForm, 
      academic_year: defaultAddYear, 
      name: `Semana ${nextNum}`,
      start_date,
      end_date
    });
    setIsAdding(true);
  };

  const makeDerivedForm = (form) => ({
    ...form,
    school_days: countSchoolDays(form.start_date, form.end_date, activeDays),
    academic_year: form.academic_year || defaultAddYear || (form.start_date ? form.start_date.slice(0, 4) : ''),
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const payload = makeDerivedForm(addForm);
    try {
      await apiClient.createAcademicWeek(payload);
      await refreshData();
      setIsAdding(false);
      setAddForm({ ...emptyForm, academic_year: defaultAddYear });
    } catch (err) {
      setErrorMsg(`Falha ao criar semana: ${err.message}`);
    } finally { setIsSaving(false); }
  };

  const startEditing = (week) => {
    setIsEditing(week.id);
    setEditForm({
      name: week.name || '',
      start_date: week.start_date || '',
      end_date: week.end_date || '',
      category: week.category || 'regular',
      academic_year: week.academic_year || '2026', // Use 2026 for editing if empty
    });
  };

  const saveEdit = async (id) => {
    setIsSaving(true);
    const payload = makeDerivedForm(editForm);
    try {
      await apiClient.updateAcademicWeek(id, payload);
      await refreshData();
      setIsEditing(null);
    } catch (err) {
      setErrorMsg(`Falha ao atualizar semana: ${err.message}`);
    } finally { setIsSaving(false); }
  };

  const removeWeek = async (id) => {
    if (!confirm('Deseja realmente excluir esta semana?')) return;
    try {
      await apiClient.deleteAcademicWeek(id);
      await refreshData();
    } catch (err) { setErrorMsg(`Falha ao excluir semana: ${err.message}`); }
  };

  // Inline day-count preview for a form
  const previewDays = (form) => countSchoolDays(form.start_date, form.end_date, activeDays);

  return (
    <div className={`p-6 rounded-3xl border overflow-hidden mt-6 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-700/30">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
            <CalendarDays className="text-violet-500" /> Semanas Acadêmicas
          </h2>
          <p className="text-sm opacity-60 mt-1 font-medium">Cadastre semanas letivas agrupadas por Ano Letivo e categoria.</p>
        </div>
        {!isAdding && (
          <button
            onClick={handleOpenAdd}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow hover:scale-105 transition-all ${isDarkMode ? 'bg-violet-600 hover:bg-violet-500 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'}`}
          >
            <Plus size={16} /> Nova Semana
          </button>
        )}
      </div>

      {/* ADD FORM */}
      {isAdding && (
        <form onSubmit={handleAdd} className={`p-4 rounded-xl border mb-6 animate-in slide-in-from-top-4 ${isDarkMode ? 'bg-slate-800/80 border-violet-500/50' : 'bg-violet-50 border-violet-200'}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Nome da Semana</label>
              <input required type="text" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} placeholder="Ex: Semana 01" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Categoria</label>
              <select value={addForm.category} onChange={e => setAddForm({...addForm, category: e.target.value})} className={inputClass}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Ano Letivo</label>
              <select value={addForm.academic_year} onChange={e => setAddForm({...addForm, academic_year: e.target.value})} className={inputClass}>
                {latestYear && <option value={latestYear}>{latestYear} (atual)</option>}
                {yearsList.filter(y => y !== latestYear).map(y => <option key={y} value={y}>{y}</option>)}
                {yearsList.length === 0 && addForm.start_date && <option value={addForm.start_date.slice(0,4)}>{addForm.start_date.slice(0,4)} (do início)</option>}
                <option value="">Sem ano definido</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Data de Início</label>
              <input required type="date" value={addForm.start_date} onChange={e => setAddForm({...addForm, start_date: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Data de Fim</label>
              <input required type="date" value={addForm.end_date} onChange={e => setAddForm({...addForm, end_date: e.target.value})} className={inputClass} />
            </div>
            {/* Day count preview */}
            <div className="flex items-end">
              <div className={`w-full p-3 rounded-xl border text-center ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                <p className="text-[10px] uppercase tracking-widest font-black opacity-50">Dias Letivos</p>
                <p className={`text-3xl font-black mt-1 ${isDarkMode ? 'text-violet-400' : 'text-violet-600'}`}>
                  {addForm.start_date && addForm.end_date ? previewDays(addForm) : '—'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button type="button" onClick={() => setIsAdding(false)} className={`p-2.5 rounded-lg border transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'}`}><X size={18}/></button>
            <button disabled={isSaving} type="submit" className={`px-6 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest text-white transition-all shadow-md ${isDarkMode ? 'bg-violet-600 hover:bg-violet-500' : 'bg-violet-600 hover:bg-violet-700'} ${isSaving ? 'opacity-50' : ''}`}>
              {isSaving ? 'Salvando…' : 'Salvar Semana'}
            </button>
          </div>
        </form>
      )}

      {/* WEEK LIST — grouped by category for the selected year */}
      {academicWeeks.filter(w => (w.academic_year || '2026') === selectedConfigYear).length === 0 && !isAdding ? (
        <div className="text-center py-10 opacity-50">
          <CalendarDays size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-bold">Nenhuma semana letiva cadastrada para {selectedConfigYear}.</p>
          <p className="text-xs mt-1">Clique em "Nova Semana" para criar a primeira.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Year header */}
          <div className={`flex items-center justify-between px-4 py-2 rounded-xl mb-3 ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100 border border-slate-200'}`}>
            <div className="flex items-center gap-2">
              <BookOpen size={16} className={isDarkMode ? 'text-violet-400' : 'text-violet-600'} />
              <span className="font-black text-sm uppercase tracking-widest">{selectedConfigYear}</span>
            </div>
            <div className={`flex items-center gap-1.5 text-xs font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
              <span className="text-lg font-black">{totalsByYear[selectedConfigYear] || 0}</span>
              <span className="opacity-70">dias letivos no ano</span>
            </div>
          </div>

          {/* Categories within selected year */}
          {CATEGORIES.map(catDef => {
            const items = activeYearWeeks[catDef.value] || [];
            if (items.length === 0) return null;
            return (
              <div key={catDef.value} className="mb-4">
                <div className="flex items-center gap-2 mb-2 ml-1">
                  <CategoryBadge category={catDef.value} isDarkMode={isDarkMode} />
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{items.length} semana{items.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-2">
                  {items.map(week => (
                    <div key={week.id} className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border transition-all ${isDarkMode ? 'bg-slate-800/40 border-slate-700 hover:border-slate-600' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                      {isEditing === week.id ? (
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-3 w-full">
                          <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className={`col-span-2 p-2 text-sm font-bold rounded border outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`} />
                          <select value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} className={`p-2 text-sm font-bold rounded border outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}>
                            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                          <input type="date" value={editForm.start_date} onChange={e => setEditForm({...editForm, start_date: e.target.value})} className={`p-2 text-sm font-bold rounded border outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`} />
                          <input type="date" value={editForm.end_date} onChange={e => setEditForm({...editForm, end_date: e.target.value})} className={`p-2 text-sm font-bold rounded border outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`} />
                          <div className={`col-span-2 md:col-span-5 text-xs font-bold ${isDarkMode ? 'text-violet-400' : 'text-violet-600'}`}>
                            → {previewDays(editForm)} dias letivos calculados
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-base">{week.name}</h4>
                            <CategoryBadge category={week.category || 'regular'} isDarkMode={isDarkMode} />
                            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-violet-900/40 text-violet-300' : 'bg-violet-100 text-violet-700'}`}>
                              {week.school_days ? week.school_days : countSchoolDays(week.start_date, week.end_date, activeDays)} dias letivos
                            </span>
                          </div>
                          <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {new Date(week.start_date + 'T12:00:00').toLocaleDateString('pt-BR')} até {new Date(week.end_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 shrink-0">
                        {isEditing === week.id ? (
                          <>
                            <button onClick={() => saveEdit(week.id)} disabled={isSaving} className={`p-2 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors ${isSaving ? 'opacity-50' : ''}`}><Check size={20}/></button>
                            <button onClick={() => setIsEditing(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-400/10 transition-colors"><X size={20}/></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEditing(week)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-400/10 transition-colors"><Edit3 size={18}/></button>
                            <button onClick={() => removeWeek(week.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"><Trash2 size={18}/></button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
