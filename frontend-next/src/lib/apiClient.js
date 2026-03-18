// ==========================================
// CONFIGURAÇÃO DA API REST (Backend SQLite)
// ==========================================
const API_URL = '/api';

// Proteção para ambientes de Container (SSR/Build) que não possuem window/sessionStorage na compilação
let internalSessionToken = '';

export const setToken = (t) => { 
  internalSessionToken = t;
  if (typeof window !== 'undefined') {
    if (t) {
      sessionStorage.setItem('admin_token', t);
      fetch('/api/session', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ token: t })
      }).catch(e => console.warn('session route fail', e));
    } else {
      sessionStorage.removeItem('admin_token');
      fetch('/api/session', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ action: 'logout' })
      }).catch(e => console.warn('logout route fail', e));
    }
  }
};

export const getHeaders = () => {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') || internalSessionToken : internalSessionToken;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

// Cliente de API com Fallback Local para testes sem backend
export const apiClient = {
  async fetchAll(year) {
    try {
      const configUrl = year ? `${API_URL}/config?year=${year}` : `${API_URL}/config`;
      const [schedRes, confRes, weekRes] = await Promise.all([
        fetch(`${API_URL}/schedules`),
        fetch(configUrl),
        fetch(`${API_URL}/academic-weeks`)
      ]);
      if (!schedRes.ok) throw new Error("API Offline");
      const schedules = await schedRes.json();
      const config = await confRes.json();
      const academicWeeks = weekRes.ok ? await weekRes.json() : [];
      return { schedules, config, academicWeeks };
    } catch (e) { throw e; }
  },

  async login(username, password) {
    try {
      const res = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ username, password }) });
      
      if (!res.ok) { 
        let errorMsg = "Credenciais inválidas";
        try {
          const err = await res.json(); 
          errorMsg = err.error || errorMsg;
        } catch (e) {
          // Se não for JSON, tenta pegar como texto ou usa o statusText
          const text = await res.text().catch(() => "");
          errorMsg = text || `Erro ${res.status}: ${res.statusText}`;
        }
        throw new Error(errorMsg); 
      }
      
      return await res.json(); 
    } catch (e) {
      if (e.message.includes("fetch") && typeof window !== 'undefined') {
        const mockUsers = JSON.parse(localStorage.getItem('sqlite_mock_users') || '[]');
        const user = mockUsers.find(u => u.username === username && u.password === btoa(encodeURIComponent(password)));
        if (!user) throw new Error("Usuário ou senha incorretos.");
        return { token: 'mock_jwt_token_123' };
      }
      throw e;
    }
  },

  // Funções avulsas de alterar senha e cadastro independente deletadas conforme instrução

  async saveSchedule(weekKey, dataObj) {
    try {
      const res = await fetch(`${API_URL}/schedules`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ id: weekKey, ...dataObj }) });
      if (!res.ok) {
        if(res.status === 401 || res.status === 403) throw new Error("Não autorizado. Faça login novamente.");
        throw new Error("Falha na API");
      }
    } catch (e) {
      if (e.message.includes("autorizado")) throw e;
      if (typeof window !== 'undefined') {
        const schedules = JSON.parse(localStorage.getItem('sqlite_mock_schedules') || '[]');
        const filtered = schedules.filter(s => s.id !== weekKey);
        localStorage.setItem('sqlite_mock_schedules', JSON.stringify([...filtered, { id: weekKey, ...dataObj }]));
      }
    }
  },

  async deleteSchedule(weekKey) {
    try {
      const res = await fetch(`${API_URL}/schedules/${encodeURIComponent(weekKey)}`, { method: 'DELETE', headers: getHeaders() });
      if (!res.ok) {
        if(res.status === 401 || res.status === 403) throw new Error("Não autorizado. Faça login novamente.");
        throw new Error("Falha na API");
      }
    } catch (e) {
      if (e.message.includes("autorizado")) throw e;
      if (typeof window !== 'undefined') {
        const schedules = JSON.parse(localStorage.getItem('sqlite_mock_schedules') || '[]');
        localStorage.setItem('sqlite_mock_schedules', JSON.stringify(schedules.filter(s => s.id !== weekKey)));
      }
    }
  },

  async updateConfig(opts) {
    try {
      const res = await fetch(`${API_URL}/config`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(opts) });
      if (!res.ok) {
        if(res.status === 401 || res.status === 403) throw new Error("Não autorizado. Faça login novamente.");
        throw new Error("Falha na API");
      }
    } catch (e) {
      if (e.message.includes("autorizado")) throw e;
      if (typeof window !== 'undefined') {
        const key = opts.year ? `sqlite_mock_config_${opts.year}` : 'sqlite_mock_config';
        localStorage.setItem(key, JSON.stringify(opts));
      }
    }
  },

  async importConfig(fromYear, toYear, options = null) {
    try {
      const res = await fetch(`${API_URL}/config/import`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ fromYear, toYear, options }) });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Falha ao importar");
      }
      return await res.json();
    } catch (e) {
      if (typeof window !== 'undefined' && e.message.includes("fetch")) {
        const fromKey = `sqlite_mock_config_${fromYear}`;
        const toKey = `sqlite_mock_config_${toYear}`;
        const fromData = JSON.parse(localStorage.getItem(fromKey));
        if(!fromData) throw new Error("Nenhuma configuração encontrada no ano de origem.");
        
        let toData = JSON.parse(localStorage.getItem(toKey) || '{}');
        const ops = options || { days: true, times: true, bimesters: true, default: true };
        
        if (ops.days) toData.activeDays = fromData.activeDays;
        if (ops.times) toData.classTimes = fromData.classTimes;
        if (ops.bimesters) toData.bimesters = fromData.bimesters;
        if (ops.default) toData.activeDefaultScheduleId = fromData.activeDefaultScheduleId;
        
        localStorage.setItem(toKey, JSON.stringify(toData));
        return { success: true };
      }
      throw e;
    }
  },

  async createAcademicWeek(data) {
    const res = await fetch(`${API_URL}/academic-weeks`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
    if (!res.ok) {
      if(res.status === 401 || res.status === 403) throw new Error("Não autorizado. Faça login novamente.");
      throw new Error("Falha ao criar semana");
    }
    return await res.json();
  },

  async updateAcademicWeek(id, data) {
    const res = await fetch(`${API_URL}/academic-weeks/${id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) });
    if (!res.ok) {
      if(res.status === 401 || res.status === 403) throw new Error("Não autorizado. Faça login novamente.");
      throw new Error("Falha ao atualizar semana");
    }
  },

  async deleteAcademicWeek(id) {
    const res = await fetch(`${API_URL}/academic-weeks/${id}`, { method: 'DELETE', headers: getHeaders() });
    if (!res.ok) {
      if(res.status === 401 || res.status === 403) throw new Error("Não autorizado. Faça login novamente.");
      throw new Error("Falha ao deletar semana");
    }
  },

  async fetchCurriculum(type) {
    try {
      const res = await fetch(`${API_URL}/admin/curriculum/${type}`);
      if (!res.ok) throw new Error(`Falha ao carregar ${type}`);
      return await res.json();
    } catch (e) { throw e; }
  },

  async deleteCurriculum(type, id) {
    try {
      const res = await fetch(`${API_URL}/admin/curriculum/${type}/${id}`, { method: 'DELETE', headers: getHeaders() });
      if (!res.ok) throw new Error(`Falha ao remover ${type}`);
      return await res.json();
    } catch (e) { throw e; }
  },

  async fetchTeachers() {
    try {
      const res = await fetch(`${API_URL}/admin/teachers`);
      if (!res.ok) throw new Error('Falha ao buscar professores');
      return await res.json();
    } catch (e) { throw e; }
  },

  async saveTeachersBatch(dataArray) {
    try {
      const res = await fetch(`${API_URL}/admin/teachers/batch`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(dataArray)
      });
      if (!res.ok) throw new Error('Falha ao salvar professores em lote');
      return await res.json();
    } catch (e) { throw e; }
  },

  async deleteTeacher(siape) {
    try {
      const res = await fetch(`${API_URL}/admin/teachers/${siape}`, { method: 'DELETE', headers: getHeaders() });
      if (!res.ok) throw new Error('Falha ao remover professor');
      return await res.json();
    } catch (e) { throw e; }
  },

  // --- SOLICITAÇÕES DE MUDANÇA (PROMPT 2) ---
  async fetchRequests(siape = null) {
    try {
      const url = siape ? `${API_URL}/requests?siape=${siape}` : `${API_URL}/requests`;
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) throw new Error('Falha ao buscar solicitações');
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  async submitRequest(data) {
    const res = await fetch(`${API_URL}/professor/request`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
       const err = await res.json().catch(() => ({}));
       throw new Error(err.error || 'Falha ao enviar solicitação');
    }
    return await res.json();
  },

  async updateRequestStatus(id, status, admin_feedback = '') {
    const res = await fetch(`${API_URL}/requests/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status, admin_feedback })
    });
    if (!res.ok) throw new Error('Falha ao atualizar solicitação');
    return await res.json();
  }
};
