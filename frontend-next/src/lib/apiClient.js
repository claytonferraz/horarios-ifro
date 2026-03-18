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
    } catch (e) {
      if (typeof window !== 'undefined') {
        console.warn("⚠️ Backend SQLite não detectado. Usando modo de simulação LocalStorage.");
        const configMockKey = year ? `sqlite_mock_config_${year}` : 'sqlite_mock_config';
        const schedules = JSON.parse(localStorage.getItem('sqlite_mock_schedules') || '[]');
        const config = JSON.parse(localStorage.getItem(configMockKey) || '{"disabledWeeks": [], "activeDays": null, "classTimes": null, "bimesters": null, "activeDefaultScheduleId": null}');
        const academicWeeks = JSON.parse(localStorage.getItem('sqlite_mock_academic_weeks') || '[]');
        return { schedules, config, academicWeeks };
      }
      return { schedules: [], config: { disabledWeeks: [], activeDays: null, classTimes: null, bimesters: null, activeDefaultScheduleId: null }, academicWeeks: [] };
    }
  },

  async checkStatus() {
    try {
      const res = await fetch(`${API_URL}/auth/me`, { headers: getHeaders() });
      if (!res.ok) return null;
      return await res.json(); 
    } catch (e) {
      return null;
    }
  },

  async fetchAdminMeta() {
    try {
      const [discRes, yearsRes, subjRes] = await Promise.all([
        fetch(`${API_URL}/admin/disciplines`),
        fetch(`${API_URL}/admin/academic-years`),
        fetch(`${API_URL}/admin/subject-hours`)
      ]);
      if (!discRes.ok || !yearsRes.ok || !subjRes.ok) throw new Error("API Meta Offline");
      return { 
        disciplines: await discRes.json(), 
        academicYears: await yearsRes.json(),
        subjectHours: await subjRes.json()
      };
    } catch (e) {
      if (typeof window !== 'undefined') {
        return {
          disciplines: JSON.parse(localStorage.getItem('sqlite_mock_disciplines') || '{}'),
          academicYears: JSON.parse(localStorage.getItem('sqlite_mock_academic_years') || '{}'),
          subjectHours: JSON.parse(localStorage.getItem('sqlite_mock_subject_hours') || '{}')
        };
      }
      return { disciplines: {}, academicYears: {}, subjectHours: {} };
    }
  },
  
  async saveDisciplineMeta(id, data) {
    try {
      const res = await fetch(`${API_URL}/admin/disciplines`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ id, ...data }) });
      if (!res.ok) throw new Error("Falha ao salvar disciplina");
    } catch (e) {
      if (typeof window !== 'undefined') {
        const current = JSON.parse(localStorage.getItem('sqlite_mock_disciplines') || '{}');
        current[id] = { ...current[id], ...data };
        localStorage.setItem('sqlite_mock_disciplines', JSON.stringify(current));
      }
    }
  },

  async saveSubjectHours(id, totalHours) {
    try {
      const res = await fetch(`${API_URL}/admin/subject-hours`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ id, totalHours }) });
      if (!res.ok) throw new Error("Falha ao salvar carga horária");
    } catch (e) {
      if (typeof window !== 'undefined') {
        const current = JSON.parse(localStorage.getItem('sqlite_mock_subject_hours') || '{}');
        current[id] = { totalHours };
        localStorage.setItem('sqlite_mock_subject_hours', JSON.stringify(current));
      }
    }
  },

  async saveAcademicYearMeta(year, data) {
    try {
      const res = await fetch(`${API_URL}/admin/academic-years`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ year, ...data }) });
      if (!res.ok) throw new Error("Falha ao salvar ano letivo");
    } catch (e) {
      if (typeof window !== 'undefined') {
        const current = JSON.parse(localStorage.getItem('sqlite_mock_academic_years') || '{}');
        current[year] = { ...current[year], ...data };
        localStorage.setItem('sqlite_mock_academic_years', JSON.stringify(current));
      }
    }
  },

  async checkSetup() {
    try {
      const res = await fetch(`${API_URL}/auth/setup`);
      if (!res.ok) throw new Error("API Auth Offline");
      return await res.json(); 
    } catch (e) {
      if (typeof window !== 'undefined') {
        const mockUsers = JSON.parse(localStorage.getItem('sqlite_mock_users') || '[]');
        return { needsSetup: mockUsers.length === 0 };
      }
      return { needsSetup: false };
    }
  },

  async setupAdmin(username, password) {
    try {
      const res = await fetch(`${API_URL}/auth/setup`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ username, password }) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Falha na criação"); }
      return await res.json();
    } catch (e) {
      if (e.message.includes("fetch") && typeof window !== 'undefined') {
        const mockUsers = JSON.parse(localStorage.getItem('sqlite_mock_users') || '[]');
        if (mockUsers.length > 0) throw new Error("Admin já configurado.");
        mockUsers.push({ username, password: btoa(encodeURIComponent(password)) });
        localStorage.setItem('sqlite_mock_users', JSON.stringify(mockUsers));
        return { message: "Setup mock concluído" };
      }
      throw e;
    }
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
    } catch (e) {
      if (typeof window !== 'undefined') {
        return JSON.parse(localStorage.getItem(`sqlite_mock_curriculum_${type}`) || '[]');
      }
      return [];
    }
  },

  async saveCurriculum(type, data) {
    try {
      const res = await fetch(`${API_URL}/admin/curriculum/${type}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) });
      if (!res.ok) throw new Error(`Falha ao salvar ${type}`);
      return await res.json();
    } catch (e) {
      if (typeof window !== 'undefined') {
        const current = JSON.parse(localStorage.getItem(`sqlite_mock_curriculum_${type}`) || '[]');
        const existingIdx = current.findIndex(c => c.id === data.id);
        if (existingIdx > -1) current[existingIdx] = data;
        else current.push(data);
        localStorage.setItem(`sqlite_mock_curriculum_${type}`, JSON.stringify(current));
        return { success: true, id: data.id };
      }
      throw e;
    }
  },

  async deleteCurriculum(type, id) {
    try {
      const res = await fetch(`${API_URL}/admin/curriculum/${type}/${id}`, { method: 'DELETE', headers: getHeaders() });
      if (!res.ok) throw new Error(`Falha ao remover ${type}`);
      return await res.json();
    } catch (e) {
      if (typeof window !== 'undefined') {
        const current = JSON.parse(localStorage.getItem(`sqlite_mock_curriculum_${type}`) || '[]');
        localStorage.setItem(`sqlite_mock_curriculum_${type}`, JSON.stringify(current.filter(c => c.id !== id)));
        return { success: true };
      }
      throw e;
    }
  },

  async fetchTeachers() {
    try {
      const res = await fetch(`${API_URL}/admin/teachers`);
      if (!res.ok) throw new Error('Falha ao buscar professores');
      return await res.json();
    } catch (e) {
      if (typeof window !== 'undefined') {
        return JSON.parse(localStorage.getItem('sqlite_mock_teachers') || '[]');
      }
      return [];
    }
  },

  async saveTeacher(data) {
    try {
      const res = await fetch(`${API_URL}/admin/teachers`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Falha ao salvar professor');
      return await res.json();
    } catch (e) {
      if (typeof window !== 'undefined') {
        const current = JSON.parse(localStorage.getItem('sqlite_mock_teachers') || '[]');
        const idx = current.findIndex(t => t.siape === data.siape);
        if (idx > -1) current[idx] = data; else current.push(data);
        localStorage.setItem('sqlite_mock_teachers', JSON.stringify(current));
        return { success: true, siape: data.siape };
      }
      throw e;
    }
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
    } catch (e) {
      if (typeof window !== 'undefined') {
        let current = JSON.parse(localStorage.getItem('sqlite_mock_teachers') || '[]');
        dataArray.forEach(data => {
          let targetSiape = data.oldSiape || data.siape;
          const idx = current.findIndex(t => t.siape === targetSiape);
          const newRep = {
             siape: data.siape,
             nome_exibicao: data.nome_exibicao || '',
             nome_completo: data.nome_completo,
             email: data.email || null,
             status: data.status || 'ativo',
             perfis: data.perfis || [],
             atua_como_docente: data.atua_como_docente || 0,
             exigir_troca_senha: data.exigir_troca_senha !== undefined ? data.exigir_troca_senha : 1
          };
          if (idx > -1) current[idx] = { ...current[idx], ...newRep }; 
          else current.push(newRep);
        });
        localStorage.setItem('sqlite_mock_teachers', JSON.stringify(current));
        return { success: true, count: dataArray.length };
      }
      throw e;
    }
  },

  async deleteTeacher(siape) {
    try {
      const res = await fetch(`${API_URL}/admin/teachers/${siape}`, { method: 'DELETE', headers: getHeaders() });
      if (!res.ok) throw new Error('Falha ao remover professor');
      return await res.json();
    } catch (e) {
      if (typeof window !== 'undefined') {
        const current = JSON.parse(localStorage.getItem('sqlite_mock_teachers') || '[]');
        localStorage.setItem('sqlite_mock_teachers', JSON.stringify(current.filter(t => t.siape !== siape)));
        return { success: true };
      }
      throw e;
    }
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
