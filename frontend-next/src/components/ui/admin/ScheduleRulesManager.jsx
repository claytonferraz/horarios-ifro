import React, { useEffect } from 'react';
import { Settings, ShieldAlert, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useScheduleRules } from '@/hooks/useScheduleRules';

export function ScheduleRulesManager({ isDarkMode }) {
    const { rules, isLoading, errorMsg, fetchRules, updateRule, setErrorMsg } = useScheduleRules();

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    const handleToggleActive = async (rule) => {
        await updateRule(rule.id, {
            severity: rule.severity,
            is_active: rule.is_active ? 0 : 1, // toggle
            exceptions: typeof rule.exceptions === 'string' ? JSON.parse(rule.exceptions || '{}') : rule.exceptions
        });
    };

    const handleSeverityChange = async (rule, newSeverity) => {
        await updateRule(rule.id, {
            severity: newSeverity,
            is_active: rule.is_active,
            exceptions: typeof rule.exceptions === 'string' ? JSON.parse(rule.exceptions || '{}') : rule.exceptions
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
                                <button className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 shadow-sm border hover:bg-slate-50'}`}>
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
        </div>
    );
}
