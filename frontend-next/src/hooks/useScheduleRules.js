import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';

export function useScheduleRules() {
    const [rules, setRules] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const fetchRules = useCallback(async (year) => {
        setIsLoading(true);
        setErrorMsg('');
        try {
            const data = await apiClient.fetchScheduleRules(year);
            setRules(data || []);
        } catch (err) {
            setErrorMsg(err.message || 'Erro ao carregar regras.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateRule = useCallback(async (id, data) => {
        setIsLoading(true);
        setErrorMsg('');
        try {
            const result = await apiClient.updateScheduleRule(id, data);
            // Atualiza a regra específica no estado local para resposta instantânea
            if (result.rule) {
                setRules(prev => prev.map(r => r.id === id ? result.rule : r));
            }
            return true;
        } catch (err) {
            setErrorMsg(err.message || 'Erro ao atualizar regra.');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        rules,
        isLoading,
        errorMsg,
        fetchRules,
        updateRule,
        setErrorMsg
    };
}
