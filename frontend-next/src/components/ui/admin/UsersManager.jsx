import React, { useState, useEffect, useMemo } from 'react';
import { User, Users, Search, Plus, Trash2, RotateCcw, Save, ShieldCheck, ShieldAlert, FileText, Upload, Shield } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

export function UsersManager({ isDarkMode, showConfirm, refreshGlobalTeachers }) {
  const { userRole } = useAuth();
  const isAdminLogado = userRole === 'admin';
  const [teachers, setTeachers] = useState([]);
  const [originalTeachers, setOriginalTeachers] = useState([]); // Keep track of original state for changes
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterView, setFilterView] = useState('Todos'); // Todos, Docentes, TAEs, Inativos
  
  // Painel de Importação
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      let dbTeachers = await refreshGlobalTeachers();
      dbTeachers.sort((a,b) => a.nome_completo.localeCompare(b.nome_completo));
      // Add a client-only id for new unsaved objects tracking
      const mapped = dbTeachers.map(t => ({ ...t, oldSiape: t.siape, _clientId: t.siape }));
      setTeachers(mapped);
      setOriginalTeachers(JSON.parse(JSON.stringify(mapped)));
    } catch (e) {
      console.error("Erro ao carregar professores:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredTeachers = useMemo(() => {
    let filtered = teachers.filter(t => t.nome_completo.toLowerCase().includes(search.toLowerCase()) || (t.siape || '').toLowerCase().includes(search.toLowerCase()) || (t.nome_exibicao || '').toLowerCase().includes(search.toLowerCase()));
    
    if (filterView === 'Apenas Docentes') {
      filtered = filtered.filter(t => t.atua_como_docente === 1 || t.atua_como_docente === true);
    } else if (filterView === 'Apenas TAEs') {
      filtered = filtered.filter(t => t.perfis.includes('TAE'));
    } else if (filterView === 'Inativos') {
      filtered = filtered.filter(t => t.status !== 'ativo');
    }
    
    return filtered;
  }, [teachers, search, filterView]);

  const hasChanges = useMemo(() => {
    if (teachers.length !== originalTeachers.length) return true;
    for (let i = 0; i < teachers.length; i++) {
        const t = teachers[i];
        const o = originalTeachers.find(ot => ot._clientId === t._clientId);
        if (!o) return true;
        if (t.siape !== o.siape || t.nome_exibicao !== o.nome_exibicao || t.nome_completo !== o.nome_completo || t.status !== o.status || t.atua_como_docente !== o.atua_como_docente || t.exigir_troca_senha !== o.exigir_troca_senha || JSON.stringify(t.perfis) !== JSON.stringify(o.perfis)) return true;
    }
    return false;
  }, [teachers, originalTeachers]);

  const validate = () => {
    const siapeSet = new Set();
    for (let t of teachers) {
      if (!t.siape || !t.siape.trim()) {
        alert(`O professor ${t.nome_completo} está sem SIAPE definido!`);
        return false;
      }
      if (!/^\d+$/.test(t.siape)) {
        alert(`O SIAPE "${t.siape}" do professor ${t.nome_completo} é inválido. Apenas números são permitidos.`);
        return false;
      }
      if (siapeSet.has(t.siape)) {
        alert(`SIAPE duplicado encontrado: ${t.siape}`);
        return false;
      }
      siapeSet.add(t.siape);
    }
    return true;
  };

  const handleBatchSave = async () => {
    if (!validate()) return;
    try {
      // prepare for save
      const payload = teachers.map(t => ({
         siape: t.siape.trim(),
         oldSiape: t.oldSiape || null,
         nome_exibicao: (t.nome_exibicao || '').trim(),
         nome_completo: t.nome_completo.trim(),
         email: t.email,
         status: t.status,
         perfis: t.perfis,
         atua_como_docente: t.atua_como_docente ? 1 : 0,
         exigir_troca_senha: t.exigir_troca_senha !== undefined ? t.exigir_troca_senha : 1
      }));

      const res = await apiClient.saveTeachersBatch(payload);
      if (res.success) {
        showConfirm("Sucesso", "Todas as alterações foram salvas. Os nomes agora estão sincronizados em todas as turmas.", () => {}, 'info');
        await refreshGlobalTeachers();
        await load();
      }
    } catch(e) {
      alert("Erro ao salvar: " + e.message);
    }
  };

  const updateTeacher = (clientId, field, value) => {
    setTeachers(teachers.map(t => t._clientId === clientId ? { ...t, [field]: value } : t));
  };

  const handleToggleAdminStatus = async (teacher) => {
    if (!teacher.oldSiape) return alert("Salve o servidor primeiro antes de modificar permissões.");
    const newValue = teacher.is_admin === 1 ? 0 : 1;
    const actionName = newValue === 1 ? "Promover a Administrador" : "Remover de Administrador";
    
    showConfirm(actionName, `Deseja ${newValue === 1 ? 'conceder' : 'revogar'} os privilégios de super administrador para ${teacher.nome_completo}?`, async () => {
      try {
        await apiClient.updateAdminStatus(teacher.oldSiape, newValue === 1);
        alert(`Privilégios atualizados com sucesso!`);
        updateTeacher(teacher._clientId, 'is_admin', newValue);
        // Opcional: atualizar os originais para não acusar "mudança pendente" sobre este campo que já foi salvo
        setOriginalTeachers(prev => prev.map(ot => ot._clientId === teacher._clientId ? { ...ot, is_admin: newValue } : ot));
        await refreshGlobalTeachers();
      } catch (e) {
        alert("Erro ao alterar privilégios: " + e.message);
      }
    }, 'info');
  };

  const handleAddEmpty = () => {
    setTeachers([{
      siape: '',
      oldSiape: null,
      nome_exibicao: '',
      nome_completo: '',
      email: '',
      status: 'ativo',
      perfis: ['Professor'],
      is_admin: 0,
      atua_como_docente: 1,
      exigir_troca_senha: 1,
      _clientId: Math.random().toString(36).substr(2, 9)
    }, ...teachers]);
  };

  const togglePerfil = (clientId, perfil) => {
    setTeachers(teachers.map(t => {
      if (t._clientId !== clientId) return t;
      const perfis = t.perfis || [];
      if (perfis.includes(perfil)) return { ...t, perfis: perfis.filter(p => p !== perfil) };
      return { ...t, perfis: [...perfis, perfil] };
    }));
  };

  const handleClearDuplicates = () => {
     showConfirm("Limpar Duplicados", "Essa ação vai eliminar duplicidades onde o NOME COMPLETO for idêntico e limpar o cache do navegador. Continuar?", async () => {
       try {
         if (typeof window !== 'undefined') localStorage.removeItem('sqlite_mock_teachers');
         const unique = [];
         const names = new Set();
         const toDelete = [];
         originalTeachers.forEach(t => {
            if (!names.has(t.nome_completo)) {
               names.add(t.nome_completo);
               unique.push(t);
            } else {
               toDelete.push(t.siape);
            }
         });
         if (toDelete.length > 0) {
           await Promise.all(toDelete.map((siape) => apiClient.deleteTeacher(siape)));
         }
         setTeachers(unique);
         setOriginalTeachers(JSON.parse(JSON.stringify(unique)));
       } catch (e) {
         alert("Erro: " + e.message);
       }
     });
  };

  const handleRemove = (clientId, siape) => {
    if (siape && originalTeachers.find(t => t.siape === siape)) {
      showConfirm("Excluir Professor", "Este professor já está no banco de dados. Excluí-lo removerá o registro permanentemente. Continuar?", async () => {
        try {
          await apiClient.deleteTeacher(siape);
          setTeachers(prev => prev.filter(t => t._clientId !== clientId));
          setOriginalTeachers(prev => prev.filter(t => t._clientId !== clientId));
        } catch (e) {
          alert("Erro ao excluir do banco: " + e.message);
        }
      });
    } else {
      setTeachers(teachers.filter(t => t._clientId !== clientId));
    }
  };

  const handleResetPassword = (teacher) => {
    if (!teacher.oldSiape) return alert("Salve o professor antes de resetar a senha.");
    const currentYear = new Date().getFullYear();
    const newPass = `prof@${currentYear}`;
    showConfirm("Resetar Senha", `Deseja resetar a senha de ${teacher.nome_completo} para '${newPass}'?`, async () => {
      try {
        await apiClient.saveTeacher({
          ...teacher,
          atua_como_docente: !!teacher.atua_como_docente,
          senha: newPass,
          exigir_troca_senha: 1
        });
        alert("Senha resetada com sucesso!");
        load();
      } catch(e) {
        alert("Erro ao resetar: " + e.message);
      }
    }, 'info');
  };

  const processImport = () => {
     if (!importText.trim()) return;
     const lines = importText.split('\n');
     const newTeachers = [];

     lines.forEach(line => {
        const parts = line.split(/\t|;/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
           let siape = '';
           let nome_completo = '';
           let nome_exibicao = '';

           if (parts.length >= 3) {
             siape = parts[0].replace(/\D/g, '');
             nome_completo = parts[1];
             nome_exibicao = parts[2];
           } else {
             if (/^\d+$/.test(parts[0])) {
               siape = parts[0];
               nome_completo = parts[1];
             } else if (/^\d+$/.test(parts[1])) {
               siape = parts[1];
               nome_completo = parts[0];
             } else {
               siape = parts[0].replace(/\D/g, '');
               nome_completo = parts[1];
             }
             nome_exibicao = nome_completo.split(' ').slice(0, 2).join(' ');
           }

           if (siape && nome_completo) {
              const exists = teachers.find(t => t.siape === siape);
              if (!exists) {
                 newTeachers.push({
                   siape,
                   oldSiape: null,
                   nome_exibicao,
                   nome_completo: nome_completo,
                   email: '',
                   status: 'ativo',
                   perfis: ['Professor'],
                   is_admin: 0,
                   atua_como_docente: 1,
                   exigir_troca_senha: 1,
                   _clientId: Math.random().toString(36).substr(2, 9)
                 });
              }
           }
        }
     });

     if (newTeachers.length > 0) {
        setTeachers([...newTeachers, ...teachers]);
        setImportText('');
        setShowImport(false);
        alert(`${newTeachers.length} professores importados. Clique em "Salvar Alterações" para gravar no banco.`);
     } else {
        alert("Nenhum dado válido encontrado. Certifique-se de copiar colunas com SIAPE (números) e NOME separados por tabulação ou ponto e vírgula.");
     }
  };

  if (loading) return <div className="p-8 text-center animate-pulse text-indigo-500 font-bold uppercase tracking-widest text-xs">Carregando quadro docente...</div>;

  return (
    <div className={`rounded-2xl border shadow-sm p-6 space-y-6 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
      
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
         <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
               <Users size={20} />
            </div>
            <div>
               <h3 className="font-black text-lg uppercase tracking-widest">Gestão de Servidores</h3>
               <p className="text-xs font-bold opacity-60">Cadastro Unificado (Docentes e TAEs)</p>
            </div>
         </div>
         <div className="flex flex-wrap gap-2">
            <button onClick={handleClearDuplicates} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 ${isDarkMode ? 'bg-amber-900/40 text-amber-500 hover:bg-amber-900/60' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
               Remover Duplicados
            </button>
            <button onClick={() => setShowImport(!showImport)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 ${showImport ? 'bg-slate-700 text-white' : (isDarkMode ? 'bg-slate-900 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700')}`}>
               <FileText size={14} /> Importar Excel
            </button>
            <button onClick={handleAddEmpty} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'}`}>
               <Plus size={14} /> Novo Registro
            </button>
            <button onClick={handleBatchSave} disabled={!hasChanges} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale ${hasChanges ? 'bg-blue-600 hover:bg-blue-700 text-white' : (isDarkMode ? 'bg-slate-700 text-slate-500' : 'bg-slate-300 text-slate-400')}`}>
               <Save size={14} /> Salvar Alterações
            </button>
         </div>
      </div>

      {showImport && (
         <div className={`p-4 rounded-xl border animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <h4 className="font-black text-xs uppercase tracking-widest mb-2 flex items-center gap-2"><Upload size={14}/> Colar dados do Excel</h4>
            <p className="text-[10px] font-bold opacity-60 mb-3 block">Copie as colunas de Nome e SIAPE do Excel e cole na caixa abaixo. O sistema identificará os números automaticamente.</p>
            <textarea 
               rows="5" 
               placeholder="Ex:&#10;1234567&#9;João da Silva&#10;7654321&#9;Maria Souza"
               value={importText}
               onChange={e => setImportText(e.target.value)}
               className={`w-full p-3 rounded-lg text-xs font-mono border focus:outline-none focus:border-indigo-500 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-white border-slate-300 text-slate-700'}`}
            />
            <div className="mt-3 flex gap-2 justify-end">
               <button onClick={processImport} className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors">Processar Colagem</button>
            </div>
         </div>
      )}

      {/* FILTRO E LISTAGEM EM GRADE (GRID) */}
      <div className="flex flex-col sm:flex-row gap-4 items-center mb-2">
         <div className="flex bg-slate-200 dark:bg-slate-900 p-1 rounded-xl">
            {['Todos', 'Apenas Docentes', 'Apenas TAEs', 'Inativos'].map(fv => (
               <button 
                  key={fv} 
                  onClick={() => setFilterView(fv)}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${filterView === fv ? (isDarkMode ? 'bg-slate-700 text-white' : 'bg-white text-indigo-600 shadow-sm') : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
               >
                  {fv}
               </button>
            ))}
         </div>
         <div className="relative flex-1 w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
            <input 
               type="text" 
               placeholder="Buscar servidor por nome ou matrícula..."
               value={search}
               onChange={e => setSearch(e.target.value)}
               className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-bold border transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 focus:border-indigo-500' : 'bg-slate-50 border-slate-200 focus:border-indigo-500'}`}
            />
         </div>
      </div>

      <div className="overflow-x-auto rounded-xl border dark:border-slate-700">
         <table className="w-full text-left text-xs font-bold">
            <thead className={`border-b text-[10px] uppercase tracking-widest ${isDarkMode ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
               <tr>
                  <th className="py-3 px-3 w-28">SIAPE</th>
                  <th className="py-3 px-3 w-36">Nome de Exibição</th>
                  <th className="py-3 px-3">Nome Completo Oficial</th>
                  <th className="py-3 px-3 w-40 text-center">Perfis (Roles)</th>
                  {isAdminLogado && <th className="py-3 px-3 w-28 text-center" title="Admin Máximo do App">Admin?</th>}
                  <th className="py-3 px-3 w-28 text-center" title="Aparece nas listagens de aulas">Docente?</th>
                  <th className="py-3 px-3 w-32 text-center" title="Senha padrão vs Privada">Senha</th>
                  <th className="py-3 px-3 w-28 text-center">Status</th>
                  <th className="py-3 px-3 w-24 text-right">Controles</th>
               </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
               {filteredTeachers.map(t => {
                  const isNew = !t.oldSiape;
                  const original = originalTeachers.find(ot => ot._clientId === t._clientId);
                  const isModified = t.oldSiape && original && (t.siape !== original.siape || t.nome_exibicao !== original.nome_exibicao || t.nome_completo !== original.nome_completo || t.status !== original.status || t.atua_como_docente !== original.atua_como_docente || t.exigir_troca_senha !== original.exigir_troca_senha || JSON.stringify(t.perfis) !== JSON.stringify(original.perfis));
                  
                  return (
                  <tr key={t._clientId} className={`transition-colors ${isNew ? (isDarkMode ? 'bg-emerald-900/10' : 'bg-emerald-50') : isModified ? (isDarkMode ? 'bg-amber-900/10' : 'bg-amber-50') : (isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}`}>
                     <td className="p-2">
                        <input 
                           type="text" 
                           value={t.siape} 
                           onChange={e => updateTeacher(t._clientId, 'siape', e.target.value)} 
                           placeholder="Números" 
                           className={`w-full p-2. rounded-lg border font-mono tracking-widest uppercase transition-colors focus:ring-2 focus:ring-blue-500 outline-none ${!t.siape || !/^\d+$/.test(t.siape) ? 'border-rose-500 text-rose-500' : isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300'}`} 
                        />
                     </td>
                     <td className="p-2">
                        <input 
                           type="text" 
                           value={t.nome_exibicao || ''} 
                           onChange={e => updateTeacher(t._clientId, 'nome_exibicao', e.target.value)} 
                           placeholder="Ex: Prof Silva" 
                           className={`w-full p-2 rounded-lg border transition-colors focus:ring-2 focus:ring-indigo-500 outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300'}`} 
                        />
                     </td>
                     <td className="p-2">
                        <input 
                           type="text" 
                           value={t.nome_completo || ''} 
                           onChange={e => updateTeacher(t._clientId, 'nome_completo', e.target.value)} 
                           placeholder="Nome completo no sistema oficial" 
                           className={`w-full p-2 rounded-lg border transition-colors focus:ring-2 focus:ring-indigo-500 outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300'}`} 
                        />
                     </td>
                     <td className="p-2 text-center text-[10px] space-y-1">
                        <div className="flex items-center gap-1 justify-center whitespace-nowrap">
                           <label className="flex items-center gap-1 cursor-pointer hover:opacity-80">
                             <input type="checkbox" checked={(t.perfis || []).includes('TAE')} onChange={() => togglePerfil(t._clientId, 'TAE')} className="accent-indigo-500" /> TAE
                           </label>
                           <label className="flex items-center gap-1 cursor-pointer hover:opacity-80">
                             <input type="checkbox" checked={(t.perfis || []).includes('Professor')} onChange={() => togglePerfil(t._clientId, 'Professor')} className="accent-indigo-500" /> Prof
                           </label>
                        </div>
                        <div className="flex items-center gap-1 justify-center whitespace-nowrap opacity-80">
                           <label className="flex items-center gap-1 cursor-pointer hover:opacity-80">
                             <input type="checkbox" checked={(t.perfis || []).includes('Monitor')} onChange={() => togglePerfil(t._clientId, 'Monitor')} className="accent-indigo-500" /> Mon
                           </label>
                           <label className="flex items-center gap-1 cursor-pointer hover:opacity-80">
                             <input type="checkbox" checked={(t.perfis || []).includes('Monitor NAPNE')} onChange={() => togglePerfil(t._clientId, 'Monitor NAPNE')} className="accent-indigo-500" /> NAPNE
                           </label>
                        </div>
                     </td>
                     {isAdminLogado && (
                       <td className="p-2 text-center">
                          <button 
                             onClick={() => handleToggleAdminStatus(t)}
                             title={t.is_admin === 1 ? "Remover de Admin" : "Tornar Admin"}
                             className={`p-1.5 rounded-lg transition-colors flex items-center justify-center mx-auto ${t.is_admin === 1 ? (isDarkMode ? 'bg-amber-900/40 text-amber-400 border border-amber-800' : 'bg-amber-100 text-amber-700 border border-amber-300') : (isDarkMode ? 'text-slate-600 hover:text-amber-500' : 'text-slate-300 hover:text-amber-500')}`}
                          >
                             <Shield size={16} className={t.is_admin === 1 ? "fill-amber-500/20" : ""} />
                          </button>
                       </td>
                     )}
                     <td className="p-2 text-center">
                        <label className="flex items-center justify-center cursor-pointer">
                           <input 
                              type="checkbox" 
                              checked={t.atua_como_docente === 1}
                              onChange={e => updateTeacher(t._clientId, 'atua_como_docente', e.target.checked ? 1 : 0)}
                              className="w-4 h-4 accent-emerald-500 cursor-pointer"
                           />
                        </label>
                     </td>
                     <td className="p-2 text-center">
                        {t.exigir_troca_senha === 1 ? (
                           <span className={`px-2 py-1 rounded text-[10px] font-mono tracking-widest ${isDarkMode ? 'bg-amber-900/30 text-amber-500' : 'bg-amber-100 text-amber-700'}`} title="Senha inicial/resetada ainda não alterada pelo usuário">
                             prof@{new Date().getFullYear()}
                           </span>
                        ) : (
                           <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-200 text-slate-400'}`} title="Usuário alterou a senha">
                             PRIVADA
                           </span>
                        )}
                     </td>
                     <td className="p-2">
                        <select 
                           value={t.status} 
                           onChange={e => updateTeacher(t._clientId, 'status', e.target.value)}
                           className={`w-full p-2 rounded-lg border transition-colors focus:ring-2 focus:ring-indigo-500 outline-none font-black uppercase tracking-widest text-[10px] ${t.status === 'ativo' ? (isDarkMode ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-green-100 text-green-700 border-green-200') : (isDarkMode ? 'bg-rose-900/30 text-rose-400 border-rose-800' : 'bg-rose-100 text-rose-700 border-rose-200')}`}
                        >
                           <option value="ativo">◉ Ativ</option>
                           <option value="inativo">◎ Inat</option>
                        </select>
                     </td>
                     <td className="p-2 text-right space-x-1 whitespace-nowrap">
                        <button onClick={() => handleResetPassword(t)} title="Resetar Senha" disabled={!t.oldSiape} className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${isDarkMode ? 'bg-amber-900/30 text-amber-500 hover:bg-amber-900/50' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}><RotateCcw size={14}/></button>
                        <button onClick={() => handleRemove(t._clientId, t.oldSiape)} title="Remover" className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'bg-rose-900/30 text-rose-400 hover:bg-rose-900/50' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}`}><Trash2 size={14}/></button>
                     </td>
                  </tr>
               )})}
               {filteredTeachers.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400 uppercase tracking-widest text-xs">A lista está vazia ou a busca não encontrou resultados.</td></tr>
               )}
            </tbody>
         </table>
      </div>
      
      {hasChanges && (
         <div className="flex justify-end pt-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 animate-pulse">Existem alterações pendentes. Não esqueça de salvar!</p>
         </div>
      )}
    </div>
  );
}
