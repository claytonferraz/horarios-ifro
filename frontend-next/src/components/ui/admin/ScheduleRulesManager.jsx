import React, { useEffect, useState } from 'react';
import { Settings, ShieldAlert, CheckCircle2, AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { useScheduleRules } from '@/hooks/useScheduleRules';
import { useData } from '@/contexts/DataContext';
import { resolveTeacherName } from '@/lib/dates';

export function ScheduleRulesManager({ isDarkMode }) {
    const { rules, isLoading, errorMsg, fetchRules, updateRule, setErrorMsg } = useScheduleRules();
    const { 
        globalTeachers = [], 
        academicWeeks = [], 
        academicYearsMeta = {}, 
        selectedConfigYear, 
        setSelectedConfigYear 
    } = useData();

    // Estado do Modal de Exceções
    const [exceptionModal, setExceptionModal] = useState({ show: false, rule: null });

    useEffect(() => {
        fetchRules(selectedConfigYear);
    }, [fetchRules, selectedConfigYear]);

    const handleToggleActive = async (rule) => {
        await updateRule(rule.id, {
            severity: rule.severity,
            is_active: rule.is_active ? 0 : 1, // toggle
            exceptions: typeof rule.exceptions === 'string' ? JSON.parse(rule.exceptions || '{}') : rule.exceptions,
            academic_year: selectedConfigYear
        });
    };

    const handleSeverityChange = async (rule, newSeverity) => {
        await updateRule(rule.id, {
            severity: newSeverity,
            is_active: rule.is_active,
            exceptions: typeof rule.exceptions === 'string' ? JSON.parse(rule.exceptions || '{}') : rule.exceptions,
            academic_year: selectedConfigYear
        });
    };

    const handleOpenExceptions = (rule) => {
        const parsedExs = typeof rule.exceptions === 'string' ? JSON.parse(rule.exceptions || '{}') : rule.exceptions;
        setExceptionModal({
            show: true,
            rule,
            ignoredTeachers: parsedExs.ignoredTeachers || [],
            ignoredWeeks: parsedExs.ignoredWeeks || []
        });
    };

    const handleSaveExceptions = async () => {
        const { rule, ignoredTeachers, ignoredWeeks } = exceptionModal;
        await updateRule(rule.id, {
            severity: rule.severity,
            is_active: rule.is_active,
            exceptions: { ignoredTeachers, ignoredWeeks },
            academic_year: selectedConfigYear
        });
        setExceptionModal({ show: false, rule: null });
    };

    const toggleIgnoredTeacher = (teacherId) => {
        setExceptionModal(prev => {
            const list = prev.ignoredTeachers;
            return {
                ...prev,
                ignoredTeachers: list.includes(teacherId) ? list.filter(id => id !== teacherId) : [...list, teacherId]
            };
        });
    };

    const toggleIgnoredWeek = (weekId) => {
        setExceptionModal(prev => {
            const list = prev.ignoredWeeks;
            return {
                ...prev,
                ignoredWeeks: list.includes(weekId) ? list.filter(id => id !== weekId) : [...list, weekId]
            };
        });
    };

    if (isLoading && rules.length === 0) {
        return <div className="p-8 text-center text-slate-500 animate-pulse font-black uppercase tracking-widest text-xs">Carregando Regras...</div>;
    }

    return (
        <div className={`rounded-2xl border shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} p-6`}>
            {/* Cabeçalho */}
            <div className="flex items-center gap-4 mb-8">
                <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                    <ShieldAlert size={32} />
                </div>
                <div>
                    <h2 className={`text-2xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Motor de Regras
                    </h2>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Gerencie as restrições logicas do sistema de horários (V1)
                    </p>
                    <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="flex flex-col gap-1">
                            <label className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Ano Letivo em Edição</label>
                            <select 
                                value={selectedConfigYear}
                                onChange={(e) => setSelectedConfigYear(e.target.value)}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-bold outline-none transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'}`}
                            >
                                {Object.keys(academicYearsMeta).length > 0 ? (
                                    Object.keys(academicYearsMeta).sort((a,b) => b-a).map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))
                                ) : (
                                    <option value={new Date().getFullYear().toString()}>{new Date().getFullYear()}</option>
                                )}
                            </select>
                        </div>
                        
                        <div className="flex flex-col gap-1">
                            <label className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Status Global</label>
                            <span className={`px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter border ${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
                                Contexto: Configurando regras para {selectedConfigYear}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {errorMsg && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                    <AlertTriangle size={16} /> {errorMsg}
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {rules.map(rule => (
                    <div key={rule.id} className={`p-5 rounded-2xl border transition-all ${isDarkMode ? 'bg-slate-900/50 border-slate-700 hover:border-slate-600' : 'bg-slate-50 border-slate-200 hover:border-slate-300'} flex flex-col justify-between`}>
                        
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h3 className={`font-black text-sm uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {rule.title}
                                    {rule.is_active ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertTriangle size={16} className="text-rose-500" />}
                                </h3>
                                <p className={`mt-2 text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                    {rule.description}
                                </p>
                            </div>
                            
                            <button
                                onClick={() => handleToggleActive(rule)}
                                className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    rule.is_active 
                                    ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20' 
                                    : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20'
                                }`}
                            >
                                {rule.is_active ? 'Desativar Regra' : 'Ativar Regra'}
                            </button>
                        </div>

                        <div className={`mt-4 pt-4 border-t flex flex-wrap items-center justify-between gap-4 ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200'}`}>
                            <div className="space-y-1">
                                <label className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Nível de Severidade</label>
                                <div className="flex bg-black/5 rounded-lg p-1 gap-1">
                                    <button 
                                        onClick={() => handleSeverityChange(rule, 'WARNING')}
                                        disabled={!rule.is_active}
                                        className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                                            rule.severity === 'WARNING' 
                                            ? 'bg-amber-500 text-white shadow-sm' 
                                            : `text-slate-500 hover:bg-black/5 ${!rule.is_active && 'opacity-50 cursor-not-allowed'}`
                                        }`}
                                    >
                                        Desejável (Aviso)
                                    </button>
                                    <button 
                                        onClick={() => handleSeverityChange(rule, 'MANDATORY_WITH_EXCEPTION')}
                                        disabled={!rule.is_active}
                                        className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                                            rule.severity === 'MANDATORY_WITH_EXCEPTION' 
                                            ? 'bg-purple-500 text-white shadow-sm' 
                                            : `text-slate-500 hover:bg-black/5 ${!rule.is_active && 'opacity-50 cursor-not-allowed'}`
                                        }`}
                                    >
                                        Com Exceção
                                    </button>
                                    <button 
                                        onClick={() => handleSeverityChange(rule, 'MANDATORY')}
                                        disabled={!rule.is_active}
                                        className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                                            rule.severity === 'MANDATORY' 
                                            ? 'bg-rose-500 text-white shadow-sm' 
                                            : `text-slate-500 hover:bg-black/5 ${!rule.is_active && 'opacity-50 cursor-not-allowed'}`
                                        }`}
                                    >
                                        Obrigatória (Bloqueio)
                                    </button>
                                </div>
                            </div>
                            
                            {/* Bloco Placeholder para Gestão de Exceções */}
                            {rule.severity === 'MANDATORY_WITH_EXCEPTION' && (
                                <button 
                                    onClick={() => handleOpenExceptions(rule)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 shadow-sm border hover:bg-slate-50'}`}
                                >
                                    <Settings size={14} /> Exceções do DAPE
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {rules.length === 0 && !isLoading && (
                    <div className="col-span-full p-8 text-center text-slate-500 font-bold text-xs uppercase tracking-widest">
                        Nenhuma regra cadastrada no motor.
                    </div>
                )}
            </div>
            
            <div className={`mt-8 p-4 rounded-xl border flex items-start gap-3 ${isDarkMode ? 'bg-indigo-900/10 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
               <ShieldCheck size={24} className="shrink-0 mt-0.5" />
               <p className="text-xs leading-relaxed">
                   <b>Nota Arquitetural (V1):</b> As validações são processadas diretamente pelo Motor de Avaliação do servidor seguindo a política de <i>Strategy Pattern</i>. Desativar uma regra aqui faz com que o MasterGrid passe a ignorá-la imediatamente ao mover turmas.
               </p>
            </div>

            {/* Modal de Exceções */}
            {exceptionModal.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={`w-full max-w-2xl rounded-2xl shadow-2xl p-6 flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className={`text-xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                    Gerenciar Exceções
                                </h3>
                                <p className={`text-[10px] font-black uppercase tracking-widest opacity-60 mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Regra: {exceptionModal.rule.title}
                                </p>
                            </div>
                            <button onClick={() => setExceptionModal({show: false, rule: null})} className={`p-2 rounded-full hover:bg-opacity-80 transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                            <div className={`p-4 rounded-xl border flex items-center gap-3 ${isDarkMode ? 'bg-amber-900/10 border-amber-500/20 text-amber-200' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                                <AlertTriangle size={20} className="shrink-0" />
                                <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                                    Lógica de Isenção: A regra será relaxada se o <b>Professor estiver na lista</b> OU se for <b>Lanço em uma Semana Isenta</b>.
                                </p>
                            </div>

                            {/* Bloco de Professores Ignorados */}
                            <div>
                                <h4 className={`text-xs font-black uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Professores Isentos Desta Regra</h4>
                                <p className="text-[9px] opacity-60 mb-3 uppercase tracking-widest">A regra se tornará um Aviso apenas para estes docentes abaixo.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 h-48 overflow-y-auto border rounded-xl p-2 custom-scrollbar">
                                    {globalTeachers.length > 0 ? globalTeachers.map(teacher => {
                                        const isIgnored = exceptionModal.ignoredTeachers.includes(teacher.siape);
                                        return (
                                            <div key={teacher.siape} 
                                                 onClick={() => toggleIgnoredTeacher(teacher.siape)}
                                                 className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border text-xs transition-colors ${
                                                    isIgnored 
                                                    ? (isDarkMode ? 'bg-indigo-900/40 border-indigo-700 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-800') 
                                                    : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600')
                                                 }`}>
                                                <input type="checkbox" checked={isIgnored} onChange={() => {}} className="pointer-events-none" />
                                                <span className="truncate">{teacher.nome_exibicao || teacher.nome}</span>
                                            </div>
                                        );
                                    }) : (
                                        <div className="col-span-full text-xs p-4 text-center opacity-50">Nenhum professor registrado no ano.</div>
                                    )}
                                </div>
                            </div>

                            {/* Bloco de Semanas Ignoradas */}
                            <div>
                                <h4 className={`text-xs font-black uppercase tracking-wider mb-3 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Semanas Acadêmicas Isentas</h4>
                                <div className="grid grid-cols-1 gap-2 border rounded-xl p-2 max-h-48 overflow-y-auto custom-scrollbar">
                                    {academicWeeks.length > 0 ? academicWeeks.map(week => {
                                        const isIgnored = exceptionModal.ignoredWeeks.includes(week.id);
                                        return (
                                            <div key={week.id} 
                                                 onClick={() => toggleIgnoredWeek(week.id)}
                                                 className={`flex items-center justify-between gap-2 p-3 rounded-lg cursor-pointer border text-xs transition-colors ${
                                                    isIgnored 
                                                    ? (isDarkMode ? 'bg-rose-900/20 border-rose-800/50 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-800') 
                                                    : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600')
                                                 }`}>
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{week.name || `Semana de ${week.start_date}`}</span>
                                                    <span className="opacity-60 text-[10px] uppercase tracking-widest">{week.start_date.split('-').reverse().join('/')} até {week.end_date.split('-').reverse().join('/')}</span>
                                                </div>
                                                <input type="checkbox" checked={isIgnored} onChange={() => {}} className="pointer-events-none w-4 h-4" />
                                            </div>
                                        );
                                    }) : (
                                        <div className="text-xs p-4 text-center opacity-50">Nenhuma semana letiva especial registrada.</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t flex items-center justify-end gap-3 border-slate-200 dark:border-slate-800">
                            <button 
                                onClick={() => setExceptionModal({show: false, rule: null})}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSaveExceptions}
                                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                            >
                                <CheckCircle2 size={16} /> Salvar Exceções
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
