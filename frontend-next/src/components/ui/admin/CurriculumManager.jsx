import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, Users, Plus, Trash2, Edit2, Save, X, Settings2, CalendarDays, CheckCircle, User as UserIcon, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { MultiSelect } from '../MultiSelect';

export function CurriculumManager({ isDarkMode, academicYearsMeta, groupedDisciplinesBySerie = {} }) {
  const { userRole } = useAuth();
  const [activeTab, setActiveTab] = useState('matrices');
  const [matrices, setMatrices] = useState([]);
  const [classes, setClasses] = useState([]);
  const [globalTeachers, setGlobalTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalConfig, setModalConfig] = useState(null); // { title, message, onConfirm, type }

  const showConfirm = (title, message, onConfirm, type = 'danger') => {
    setModalConfig({ title, message, onConfirm, type });
  };

  const refreshGlobalTeachers = async () => {
    try {
      const dbTeachers = await apiClient.fetchTeachers(userRole);
      setGlobalTeachers(dbTeachers || []);
      return dbTeachers;
    } catch (e) {
      console.error("Erro ao atualizar professores:", e);
      return [];
    }
  };

  // Load initial data
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [loadedMatrices, loadedClasses, dbTeachers] = await Promise.all([
          apiClient.fetchCurriculum('matrix'),
          apiClient.fetchCurriculum('class'),
          refreshGlobalTeachers()
        ]);
        setMatrices(loadedMatrices || []);
        setClasses(loadedClasses || []);
      } catch (e) {
        console.error("Erro ao carregar currículos:", e);
      }
      setLoading(false);
    }
    load();
  }, [userRole]);

  // Shared Helper
  const generateId = () => Math.random().toString(36).substr(2, 9);

  return (
    <div className={`rounded-2xl shadow-sm border overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
      {/* GLOBAL MODAL */}
      {modalConfig && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
            <div className={`p-6 text-center ${modalConfig.type === 'danger' ? 'text-rose-500' : 'text-blue-500'}`}>
              <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${modalConfig.type === 'danger' ? 'bg-rose-500/10' : 'bg-blue-500/10'}`}>
                <AlertTriangle size={32} />
              </div>
              <h3 className="font-black text-lg uppercase tracking-widest mb-2">{modalConfig.title}</h3>
              <p className={`text-sm font-medium leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{modalConfig.message}</p>
            </div>
            <div className={`p-4 flex gap-3 border-t ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
               <button onClick={() => setModalConfig(null)} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>Cancelar</button>
               <button onClick={() => { modalConfig.onConfirm(); setModalConfig(null); }} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-white shadow-lg ${modalConfig.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
      <div className={`text-white px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 border-slate-800'}`}>
        <div className="flex items-center gap-3">
          <BookOpen size={18} className="text-indigo-400" />
          <h2 className="font-black text-sm uppercase tracking-[0.2em]">Gestão Administrativa</h2>
        </div>
      </div>

      <div className="flex border-b overflow-x-auto">
        <button
          onClick={() => setActiveTab('matrices')}
          className={`flex-1 py-3 px-4 font-black text-xs uppercase tracking-widest transition-colors whitespace-nowrap ${
            activeTab === 'matrices'
              ? (isDarkMode ? 'bg-slate-800 text-indigo-400 border-b-2 border-indigo-500' : 'bg-white text-indigo-600 border-b-2 border-indigo-600')
              : (isDarkMode ? 'bg-slate-900/50 text-slate-400 hover:text-slate-200' : 'bg-slate-50 text-slate-500 hover:text-slate-800')
          }`}
        >
          <div className="flex items-center justify-center gap-2"><BookOpen size={14} /> 1. Matrizes e Séries</div>
        </button>
        <button
          onClick={() => setActiveTab('classes')}
          className={`flex-1 py-3 px-4 font-black text-xs uppercase tracking-widest transition-colors whitespace-nowrap ${
            activeTab === 'classes'
              ? (isDarkMode ? 'bg-slate-800 text-indigo-400 border-b-2 border-indigo-500' : 'bg-white text-indigo-600 border-b-2 border-indigo-600')
              : (isDarkMode ? 'bg-slate-900/50 text-slate-400 hover:text-slate-200' : 'bg-slate-50 text-slate-500 hover:text-slate-800')
          }`}
        >
          <div className="flex items-center justify-center gap-2"><Users size={14} /> 2. Cadastro de Turma</div>
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="text-center p-12 text-blue-500 font-bold animate-pulse">Carregando dados estruturais...</div>
        ) : (
          <>
            {activeTab === 'matrices' && <MatricesTab isDarkMode={isDarkMode} matrices={matrices} setMatrices={setMatrices} generateId={generateId} groupedDisciplinesBySerie={groupedDisciplinesBySerie} academicYearsMeta={academicYearsMeta} showConfirm={showConfirm} refreshGlobalTeachers={refreshGlobalTeachers} />}
            {activeTab === 'classes' && <ClassesTab isDarkMode={isDarkMode} matrices={matrices} classes={classes} setClasses={setClasses} generateId={generateId} academicYearsMeta={academicYearsMeta} globalTeachers={globalTeachers} showConfirm={showConfirm} refreshGlobalTeachers={refreshGlobalTeachers} />}
          </>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 1. ABA DE MATRIZES
// ==========================================
function MatricesTab({ isDarkMode, matrices, setMatrices, generateId, groupedDisciplinesBySerie, academicYearsMeta, showConfirm, refreshGlobalTeachers }) {
  const [editingId, setEditingId] = useState(null);
  const [localFormData, setLocalFormData] = useState(null);
  const [filterYear, setFilterYear] = useState('');
  
  const activeYearsList = Object.keys(academicYearsMeta || {}).sort((a,b) => Number(b) - Number(a));

  useEffect(() => {
    if(!filterYear && activeYearsList.length > 0) {
       const currentY = new Date().getFullYear().toString();
       setFilterYear(activeYearsList.includes(currentY) ? currentY : activeYearsList[0]);
    }
  }, [activeYearsList, filterYear]);

  const handleStartEdit = (matrix = null) => {
    if (matrix) {
      setEditingId(matrix.id);
      const copy = JSON.parse(JSON.stringify(matrix)); // deep copy
      if (!copy.series) copy.series = [];
      if (!copy.academicYear) copy.academicYear = filterYear || new Date().getFullYear().toString();
      setLocalFormData(copy);
    } else {
      setEditingId('new');
      setLocalFormData({ 
        id: generateId(), 
        name: '', 
        course: '', 
        courseAcronym: '', 
        campus: 'Ji-Paraná',
        academicYear: filterYear || new Date().getFullYear().toString(),
        series: [] 
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setLocalFormData(null);
  };

  const handleSaveMatrix = async () => {
    if (!localFormData.name || !localFormData.course) return alert('Preencha nome e curso!');
    const saved = await apiClient.saveCurriculum('matrix', localFormData);
    if (saved.success) {
      if (editingId === 'new') {
        setMatrices([...matrices, localFormData]);
      } else {
        setMatrices(matrices.map(m => m.id === editingId ? localFormData : m));
      }
      setEditingId(null);
      setLocalFormData(null);
      
      // Refresh global teachers in case names were changed in another tab
      refreshGlobalTeachers();
    }
  };

  const handleDeleteMatrix = (id) => {
    showConfirm("Excluir Matriz", "Certeza que deseja excluir esta Matriz Curricular inteira? Essa ação não pode ser desfeita.", async () => {
      const res = await apiClient.deleteCurriculum('matrix', id);
      if (res.success) setMatrices(prev => prev.filter(m => m.id !== id));
    });
  };

  const addSerie = () => {
    setLocalFormData(prev => ({ 
      ...prev, 
      series: [{ id: generateId(), name: 'Nova Série', disciplines: [] }, ...(prev.series || [])] 
    }));
  };
  
  const copyDisciplines = (targetSerieId, sourceSerieId) => {
    if (!sourceSerieId) return;
    const allSeries = matrices.flatMap(m => m.series || []).concat(localFormData.series || []);
    const sourceSerie = allSeries.find(s => s.id === sourceSerieId);
    if (!sourceSerie || !sourceSerie.disciplines) return;
    
    if (!window.confirm(`Deseja copiar ${sourceSerie.disciplines.length} disciplinas para esta série? Disciplinas atuais serão mantidas.`)) return;

    const clonedDisciplines = sourceSerie.disciplines.map(d => ({ ...d, id: generateId() }));
    setLocalFormData(prev => ({
      ...prev,
      series: prev.series.map(s => {
        if (s.id !== targetSerieId) return s;
        return { ...s, disciplines: [...s.disciplines, ...clonedDisciplines] };
      })
    }));
  };
  
  const updateSerieName = (sId, newName) => {
    setLocalFormData(prev => ({
      ...prev,
      series: prev.series.map(s => s.id === sId ? { ...s, name: newName } : s)
    }));
  };

  const removeSerie = (sId) => {
    setLocalFormData(prev => ({ 
      ...prev, 
      series: prev.series.filter(s => s.id !== sId) 
    }));
  };

  const addDiscipline = (sId) => {
    setLocalFormData(prev => ({
      ...prev,
      series: prev.series.map(s => {
        if (s.id !== sId) return s;
        return { ...s, disciplines: [...s.disciplines, { id: generateId(), name: '', code: '', hours: 0, aulas_semanais: 0, color: 'bg-indigo-500' }] };
      })
    }));
  };

  const allDisciplines = Array.from(new Set([
    ...matrices.flatMap(m => (m.series || []).flatMap(s => (s.disciplines || []).map(d => d.name))),
    ...Object.values(groupedDisciplinesBySerie).flatMap(list => list.map(item => item.subject))
  ])).filter(Boolean).sort();

  const updateDiscipline = (sId, dId, field, value) => {
    setLocalFormData(prev => ({
      ...prev,
      series: prev.series.map(s => {
        if (s.id !== sId) return s;
        return {
          ...s,
          disciplines: s.disciplines.map(d => {
            if (d.id !== dId) return d;
            const updated = { ...d, [field]: value };
            if (field === 'hours') updated.aulas_semanais = Math.floor(value / 40);
            return updated;
          })
        };
      })
    }));
  };

  const removeDiscipline = (sId, dId) => {
    setLocalFormData(prev => ({
      ...prev,
      series: prev.series.map(s => {
        if (s.id !== sId) return s;
        return { ...s, disciplines: s.disciplines.filter(d => d.id !== dId) };
      })
    }));
  };

  if (editingId) {
    return (
      <div className={`space-y-6 animate-in fade-in zoom-in-95 duration-200`}>
        <div className="flex items-center justify-between pb-4 border-b">
          <h3 className="text-lg font-black uppercase tracking-widest">{editingId === 'new' ? 'Nova Matriz Curricular' : 'Editando Matriz'}</h3>
          <div className="flex gap-2">
            <button type="button" onClick={handleCancelEdit} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors uppercase tracking-widest">Cancelar</button>
            <button type="button" onClick={handleSaveMatrix} className="px-4 py-1.5 rounded-lg text-xs font-black bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1.5 uppercase tracking-widest"><Save size={14} /> Salvar Matriz</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Ano Letivo</label>
            <select value={localFormData.academicYear} onChange={e => setLocalFormData({...localFormData, academicYear: e.target.value})} className={`w-full px-3 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 font-bold transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
               {activeYearsList.length === 0 && <option value={localFormData.academicYear}>{localFormData.academicYear}</option>}
               {activeYearsList.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Campus IFRO</label>
            <input type="text" value={localFormData.campus || ''} onChange={e => setLocalFormData({...localFormData, campus: e.target.value})} placeholder="Ex: Ji-Paraná" className={`w-full px-3 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 font-bold transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`} />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Nome da Matriz</label>
            <input type="text" value={localFormData.name || ''} onChange={e => setLocalFormData({...localFormData, name: e.target.value})} placeholder="Ex: Informática 2024" className={`w-full px-3 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 font-bold transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`} />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Vínculo com Curso</label>
            <input type="text" value={localFormData.course || ''} onChange={e => setLocalFormData({...localFormData, course: e.target.value})} placeholder="Ex: Informática" className={`w-full px-3 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 font-bold transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`} />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Sigla do Curso</label>
            <input type="text" value={localFormData.courseAcronym || ''} onChange={e => setLocalFormData({...localFormData, courseAcronym: e.target.value})} placeholder="Ex: INFO" className={`w-full px-3 py-2.5 rounded-xl border uppercase focus:ring-2 focus:ring-indigo-500 font-bold transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`} />
          </div>
        </div>

        <div className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-black text-sm uppercase tracking-widest flex items-center gap-2"><Settings2 size={16}/> Séries (Anos Letivos da Matriz)</h4>
            <button type="button" onClick={addSerie} className={`px-3 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1 uppercase tracking-widest shadow-sm transition-all active:scale-95 ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}><Plus size={14}/> Nova Série</button>
          </div>

          <div className="space-y-6">
            {localFormData.series.map(serie => (
              <div key={serie.id} className={`rounded-xl border p-4 ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between border-b pb-3 mb-3 border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>SÉRIE</span>
                    <input 
                      type="text" 
                      value={serie.name} 
                      onChange={e => updateSerieName(serie.id, e.target.value)}
                      className="font-black text-base bg-transparent border-b-2 border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none transition-colors w-48 px-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => removeSerie(serie.id)} className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1 transition-all ${isDarkMode ? 'bg-rose-900/30 text-rose-400 hover:bg-rose-800/50' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}`}><Trash2 size={12}/> Excluir Série</button>
                  </div>
                </div>

                {serie.disciplines.length === 0 ? (
                  <p className="text-xs font-semibold opacity-50 text-center py-4">Série sem disciplinas.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <datalist id="all-disciplines">
                      {allDisciplines.map(d => <option key={d} value={d} />)}
                    </datalist>
                    <table className="w-full text-[10px] text-left">
                      <thead>
                        <tr className="uppercase tracking-widest opacity-60 font-black">
                          <th className="pb-2">Nome</th>
                          <th className="pb-2 w-24">C. Horária</th>
                          <th className="pb-2 w-24">Aulas Sem.</th>
                          <th className="pb-2 w-32">Cód. (Opcional)</th>
                          <th className="pb-2 w-12 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {serie.disciplines.map(disc => (
                          <tr key={disc.id}>
                            <td className="py-2 pr-2">
                              <input type="text" list="all-disciplines" value={disc.name} onChange={e => updateDiscipline(serie.id, disc.id, 'name', e.target.value)} placeholder="Ex: Matemática" className={`w-full p-1.5 rounded-md border font-bold ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`} />
                            </td>
                            <td className="py-2 px-2">
                              <input type="number" value={disc.hours} onChange={e => updateDiscipline(serie.id, disc.id, 'hours', Number(e.target.value))} className={`w-full p-1.5 rounded-md border font-bold text-center ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`} />
                            </td>
                            <td className="py-2 px-2">
                              <input type="number" value={disc.aulas_semanais !== undefined ? disc.aulas_semanais : Math.floor((disc.hours || 0) / 40)} onChange={e => updateDiscipline(serie.id, disc.id, 'aulas_semanais', Number(e.target.value))} className={`w-full p-1.5 rounded-md border font-bold text-center ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`} />
                            </td>
                            <td className="py-2 px-2">
                              <input type="text" value={disc.code || ''} onChange={e => updateDiscipline(serie.id, disc.id, 'code', e.target.value)} placeholder="Ex: MAT1" className={`w-full p-1.5 rounded-md border font-bold uppercase text-center ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`} />
                            </td>
                            <td className="py-2 pl-2 text-right">
                              <button type="button" onClick={() => removeDiscipline(serie.id, disc.id)} className={`p-1.5 rounded-md transition-colors ${isDarkMode ? 'text-rose-400 hover:bg-rose-900/50' : 'text-rose-600 hover:bg-rose-100'}`}><Trash2 size={14}/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-4 flex flex-col md:flex-row items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3 gap-4">
                   <div className="flex items-center gap-2 w-full md:w-auto">
                      <button type="button" onClick={() => addDiscipline(serie.id)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all w-full md:w-auto ${isDarkMode ? 'bg-emerald-900/50 text-emerald-400 hover:bg-emerald-800/80' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}><Plus size={14}/> Nova Disciplina</button>
                      <select onChange={(e) => { copyDisciplines(serie.id, e.target.value); e.target.value = ''; }} className={`w-full md:w-48 px-2 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest bg-transparent cursor-pointer ${isDarkMode ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-600'}`}>
                         <option value="">Copiar Disciplinas de...</option>
                         {matrices.map(m => (
                            <optgroup key={m.id} label={m.name}>
                               {m.series && m.series.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                               ))}
                            </optgroup>
                         ))}
                         <optgroup label="Séries Desta Matriz">
                               {localFormData.series.filter(s => s.id !== serie.id).map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                               ))}
                         </optgroup>
                      </select>
                   </div>
                   <button type="button" onClick={handleSaveMatrix} className="px-5 py-2 rounded-lg text-[10px] font-black bg-blue-600 text-white hover:bg-blue-700 transition-colors w-full md:w-auto flex items-center justify-center gap-1.5 uppercase tracking-widest shadow-sm"><Save size={14} /> Salvar Modificações</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // List View
  const displayedMatrices = matrices.filter(m => m.academicYear === filterYear || (!filterYear && !m.academicYear));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-black uppercase tracking-widest opacity-80">Catálogo de Matrizes Curriculares</h3>
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className={`text-xs font-bold px-3 py-1.5 rounded-lg border focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            {activeYearsList.length === 0 && <option value="">Sem Anos Cadastrados</option>}
            {activeYearsList.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={() => handleStartEdit()} className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 uppercase tracking-widest shadow-sm transition-all active:scale-95 ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}><Plus size={16}/> Criar Matriz</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {displayedMatrices.map(matrix => {
          const totalSeries = matrix.series ? matrix.series.length : 0;
          const totalDisciplines = matrix.series ? matrix.series.reduce((acc, s) => acc + (s.disciplines ? s.disciplines.length : 0), 0) : 0;

          return (
            <div key={matrix.id} className={`rounded-2xl border p-5 flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-md ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <div className="flex justify-between items-start mb-2">
                   <h4 className="font-black text-lg">{matrix.name}</h4>
                   <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-indigo-900/80 text-indigo-300' : 'bg-indigo-100 text-indigo-700'}`}>{matrix.campus ? `Campus ${matrix.campus}` : 'Campus não definido'}</span>
                </div>
                <div className="flex justify-between items-start mb-2">
                   <h4 className="font-black text-lg">{matrix.name}</h4>
                   <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-blue-900/80 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>{matrix.courseAcronym ? `${matrix.course} (${matrix.courseAcronym})` : matrix.course}</span>
                </div>
                <p className="text-xs font-bold opacity-60 mb-5">{totalSeries} Anos/Séries, total de {totalDisciplines} Disciplinas cadastradas.</p>
              </div>
              <div className="flex border-t pt-4 gap-2 justify-end mt-4 border-slate-200 dark:border-slate-800">
                 <button onClick={() => handleStartEdit(matrix)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors flex items-center gap-1.5 dark:bg-blue-900/30 dark:text-blue-400"><Edit2 size={12}/> Configurar</button>
                 <button onClick={() => handleDeleteMatrix(matrix.id)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors flex items-center gap-1.5 dark:bg-rose-900/30 dark:text-rose-400"><Trash2 size={12}/></button>
              </div>
            </div>
          );
        })}
        {displayedMatrices.length === 0 && (
          <div className="col-span-1 lg:col-span-2 text-center p-12 opacity-50 font-black uppercase tracking-widest">
            Sem Matrizes Curriculares Cadastradas
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 2. ABA DE TURMAS
// ==========================================
function ClassesTab({ isDarkMode, matrices, classes, setClasses, generateId, academicYearsMeta, globalTeachers = [], showConfirm, refreshGlobalTeachers }) {
  const [editingId, setEditingId] = useState(null);
  const [localFormData, setLocalFormData] = useState(null);
  const [filterYear, setFilterYear] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const activeYearsList = Object.keys(academicYearsMeta || {}).sort((a,b) => Number(b) - Number(a));
  const availableCourses = Array.from(new Set(matrices.map(m => m.course).filter(Boolean))).sort();

  const filteredMatrices = useMemo(() => {
    return matrices.filter(m => m.academicYear === filterYear);
  }, [matrices, filterYear]);

  useEffect(() => {
    if(!filterYear && activeYearsList.length > 0) {
       const currentY = new Date().getFullYear().toString();
       const targetY = activeYearsList.includes(currentY) ? currentY : activeYearsList[0];
       setFilterYear(targetY);
    }
  }, [activeYearsList, filterYear]);

  const handleStartEdit = (cls = null) => {
    if (cls) {
      setEditingId(cls.id);
      setLocalFormData(JSON.parse(JSON.stringify(cls)));
    } else {
      setEditingId('new');
      setLocalFormData({ 
        id: generateId(), 
        name: '', 
        room: '',
        academicYear: new Date().getFullYear().toString(),
        matrixId: '', 
        serieId: '', 
        professorAssignments: {},
        roomAssignments: {}
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setLocalFormData(null);
  };

  const handleSaveClass = async () => {
    if (!localFormData.name || !localFormData.matrixId || !localFormData.serieId) {
      return alert('Preencha nome da turma, escolha a matriz e a série!');
    }
    const saved = await apiClient.saveCurriculum('class', localFormData);
    if (saved.success) {
      if (editingId === 'new') {
        setClasses([...classes, localFormData]);
      } else {
        setClasses(classes.map(c => c.id === editingId ? localFormData : c));
      }
      setEditingId(null);
      setLocalFormData(null);

      // Refresh global teachers to ensure sync
      refreshGlobalTeachers();
    }
  };

  const handleDeleteClass = (id) => {
    showConfirm("Excluir Turma", "Certeza que deseja excluir esta Turma permanentemente?", async () => {
      const res = await apiClient.deleteCurriculum('class', id);
      if (res.success) {
        setClasses(prev => prev.filter(c => c.id !== id));
      }
    });
  };

  const handleDuplicateClass = (cls) => {
    showConfirm("Clonar Turma", `Deseja clonar a turma "${cls.name}" com os professores já atribuídos?`, async () => {
      const newCls = {
        ...cls,
        id: generateId(),
        name: cls.name + " (Cópia)"
      };
      const saved = await apiClient.saveCurriculum('class', newCls);
      if (saved.success) {
        setClasses(prev => [...prev, newCls]);
      }
    }, 'info');
  };

  const handleAssignmentChange = (disciplineId, teacherIdsArray) => {
    setLocalFormData(prev => ({
      ...prev,
      professorAssignments: {
        ...(prev.professorAssignments || {}),
        [disciplineId]: teacherIdsArray
      }
    }));
  };

  const handleRoomChange = (discId, roomStr) => {
    setLocalFormData(prev => ({
      ...prev,
      roomAssignments: {
        ...(prev.roomAssignments || {}),
        [discId]: roomStr
      }
    }));
  };

  if (editingId) {
    const selectedMatrix = matrices.find(m => m.id === localFormData.matrixId);
    const selectedSerie = selectedMatrix ? selectedMatrix.series.find(s => s.id === localFormData.serieId) : null;
    const disciplinesToAssign = selectedSerie ? [...selectedSerie.disciplines].sort((a, b) => a.name.localeCompare(b.name)) : [];

    return (
      <div className={`space-y-6 animate-in fade-in zoom-in-95 duration-200`}>
        <div className="flex items-center justify-between pb-4 border-b">
          <h3 className="text-lg font-black uppercase tracking-widest">{editingId === 'new' ? 'Nova Turma' : 'Editando Turma'}</h3>
          <div className="flex gap-2">
            <button onClick={handleCancelEdit} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors uppercase tracking-widest">Cancelar</button>
            <button onClick={handleSaveClass} className="px-4 py-1.5 rounded-lg text-xs font-black bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1.5 uppercase tracking-widest"><Save size={14} /> Salvar Turma</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Nome Oficial (Turma)</label>
            <input type="text" value={localFormData.name} onChange={e => setLocalFormData({...localFormData, name: e.target.value})} placeholder="Ex: 1º Ano A Informática" className={`w-full px-3 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 font-bold transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`} />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Sala Base (Turma)</label>
            <input type="text" value={localFormData.room || ''} onChange={e => setLocalFormData({...localFormData, room: e.target.value})} placeholder="Ex: Sala 10, Lab 1" className={`w-full px-3 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 font-bold transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`} />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Ano Letivo</label>
            <select value={localFormData.academicYear} onChange={e => setLocalFormData({...localFormData, academicYear: e.target.value})} className={`w-full px-3 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 font-bold transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
               {activeYearsList.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Matriz Curricular base</label>
            <select value={localFormData.matrixId} onChange={e => setLocalFormData({...localFormData, matrixId: e.target.value, serieId: ''})} className={`w-full px-3 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 font-bold transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
               <option value="">Selecione...</option>
               {matrices.map(m => <option key={m.id} value={m.id}>{m.course} - {m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Ano / Série</label>
            <select value={localFormData.serieId} onChange={e => setLocalFormData({...localFormData, serieId: e.target.value})} disabled={!localFormData.matrixId} className={`w-full px-3 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 font-bold transition-all disabled:opacity-50 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
               <option value="">Selecione...</option>
               {selectedMatrix?.series.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {selectedSerie && (
          <div className="pt-6">
            <h4 className="font-black text-sm uppercase tracking-widest flex items-center gap-2 mb-4"><Users size={16}/> Atribuição de Professores</h4>
            <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b uppercase tracking-widest font-black opacity-70 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <th className="p-3">Disciplina (Matriz)</th>
                    <th className="p-3">C.H.</th>
                    <th className="p-3">Professor(es) Atribuídos <span className="opacity-50 normal-case tracking-normal">(separados por vírgula)</span></th>
                    <th className="p-3">Sala / Ambiente <span className="opacity-50 normal-case tracking-normal">(Opcional)</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {disciplinesToAssign.length === 0 && (
                    <tr><td colSpan={3} className="text-center p-4">A série selecionada não possui disciplinas ativas.</td></tr>
                  )}
                  {disciplinesToAssign.map(disc => {
                    const assignedProfs = localFormData.professorAssignments?.[disc.id] || [];
                    const assignedRoom = localFormData.roomAssignments?.[disc.id] || '';
                    
                    return (
                      <tr key={disc.id}>
                        <td className="p-3 font-bold">{disc.name} {disc.code && <span className="opacity-50 ml-1 text-[10px] uppercase">({disc.code})</span>}</td>
                        <td className="p-3 font-black text-slate-500">{disc.hours}h</td>
                        <td className="p-2">
                          <div className="flex-1 min-w-[250px]">
                            <MultiSelect
                              options={globalTeachers.filter(t => t.atua_como_docente === 1 || t.atua_como_docente === true).map(t => ({ value: String(t.siape), label: t.nome_exibicao || t.nome_completo }))}
                              values={assignedProfs}
                              onChange={selectedIds => handleAssignmentChange(disc.id, selectedIds)}
                              placeholder="Buscar e selecionar professor(es)..."
                              isDarkMode={isDarkMode}
                            />
                          </div>
                        </td>
                        <td className="p-2">
                          <input 
                            type="text" 
                            value={assignedRoom} 
                            onChange={e => handleRoomChange(disc.id, e.target.value)} 
                            placeholder="Ex: Lab. Info 1, Quadra" 
                            className={`w-full p-2.5 rounded-lg border font-bold transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 focus:bg-slate-700' : 'bg-white border-slate-300'}`} 
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Filtered classes
  const displayedClasses = classes.filter(c => {
    const matrix = matrices.find(m => m.id === c.matrixId);
    const matchesYear = c.academicYear === filterYear;
    const matchesCourse = filterCourse ? (matrix && matrix.course === filterCourse) : true;
    return matchesYear && matchesCourse;
  }).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-xl font-black uppercase tracking-widest opacity-80">Catálogo de Turmas</h3>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Curso:</span>
            <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} className={`text-xs font-bold px-3 py-1.5 rounded-lg border focus:outline-none max-w-[150px] truncate ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <option value="">Todos</option>
              {availableCourses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Ano:</span>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className={`text-xs font-bold px-3 py-1.5 rounded-lg border focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              {activeYearsList.length === 0 && <option value="">Sem Anos Cadastrados</option>}
              {activeYearsList.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={() => handleStartEdit()} className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 uppercase tracking-widest shadow-sm transition-all active:scale-95 ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}><Plus size={16}/> Criar Turma</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border shadow-sm dark:border-slate-700">
        <table className={`w-full text-xs text-left ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white'}`}>
          <thead>
            <tr className={`border-b uppercase tracking-widest font-black ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
              <th className="py-4 px-5">Turma Oficial</th>
              <th className="py-4 px-5">Matriz Curricular</th>
              <th className="py-4 px-5">Série/Ano</th>
              <th className="py-4 px-5 text-center">Atribuições</th>
              <th className="py-4 px-5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
            {displayedClasses.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhuma turma cadastrada neste ano letivo.</td></tr>
            ) : (
              displayedClasses.map(cls => {
                const matrix = matrices.find(m => m.id === cls.matrixId);
                const serie = matrix ? matrix.series.find(s => s.id === cls.serieId) : null;
                const totalDisciplines = serie ? serie.disciplines.length : 0;
                
                let assignedCount = 0;
                if (cls.professorAssignments && serie) {
                  assignedCount = serie.disciplines.filter(d => cls.professorAssignments[d.id] && cls.professorAssignments[d.id].length > 0).length;
                }

                const isComplete = assignedCount > 0 && assignedCount >= totalDisciplines;

                return (
                  <tr key={cls.id} className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50`}>
                    <td className="py-4 px-5 font-black text-sm">{cls.name}</td>
                    <td className="py-4 px-5 font-bold opacity-80">{matrix ? matrix.name : 'Matriz Excluída'}</td>
                    <td className="py-4 px-5 font-bold opacity-80">{serie ? serie.name : '-'}</td>
                    <td className="py-4 px-5 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isComplete ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700') : (isDarkMode ? 'bg-amber-900/30 text-amber-500' : 'bg-amber-100 text-amber-700')}`}>
                         {isComplete ? <CheckCircle size={12}/> : <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"/>}
                         {assignedCount} / {totalDisciplines} Disciplinas
                      </div>
                    </td>
                    <td className="py-4 px-5 text-right space-x-2">
                       <button onClick={() => handleStartEdit(cls)} className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors dark:bg-blue-900/30 dark:text-blue-400">Atribuir</button>
                       <button onClick={() => handleDuplicateClass(cls)} className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors dark:bg-emerald-900/30 dark:text-emerald-400">Duplicar</button>
                       <button onClick={() => handleDeleteClass(cls.id)} className="px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors dark:bg-rose-900/30 dark:text-rose-400"><Trash2 size={14}/></button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
