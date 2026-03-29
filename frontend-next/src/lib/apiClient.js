// ==========================================
// CONFIGURAÇÃO DA API REST (Backend SQLite)
// ==========================================
const API_URL = '/api';
const ENABLE_OFFLINE_MOCKS = process.env.NEXT_PUBLIC_ENABLE_OFFLINE_MOCKS === 'true';

const canUseOfflineMocks = () => typeof window !== 'undefined' && ENABLE_OFFLINE_MOCKS;
const isAdminLikeRole = (role) => ['admin', 'gestao'].includes(String(role || '').toLowerCase());

export const setToken = async (t) => {
  if (typeof window === 'undefined') return;
  const payload = t ? { token: t } : { action: 'logout' };
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Falha ao atualizar sessão segura.');
};

export const getHeaders = () => {
  return {
    'Content-Type': 'application/json'
  };
};

// Cliente de API com Fallback Local para testes sem backend
export const apiClient = {
  async fetchAll(year) {
    try {
      const configUrl = year ? `${API_URL}/config?year=${year}` : `${API_URL}/config`;
      const schedulesUrl = year ? `${API_URL}/schedules?academicYear=${year}` : `${API_URL}/schedules`;
      const [schedRes, confRes, weekRes] = await Promise.all([
        fetch(schedulesUrl),
        fetch(configUrl),
        fetch(`${API_URL}/academic-weeks`)
      ]);
      if (!schedRes.ok) {
        if (schedRes.status === 403) throw new Error("Acesso público aos horários desativado pelo administrador.");
        throw new Error("API Offline");
      }
      const schedules = await schedRes.json();
      const config = await confRes.json();
      const academicWeeks = weekRes.ok ? await weekRes.json() : [];
      return { schedules, config, academicWeeks };
    } catch (e) {
      if (canUseOfflineMocks()) {
        console.warn("⚠️ Backend SQLite não detectado. Usando modo de simulação LocalStorage.");
        const configMockKey = year ? `sqlite_mock_config_${year}` : 'sqlite_mock_config';
        const schedules = JSON.parse(localStorage.getItem('sqlite_mock_schedules') || '[]');
        const config = JSON.parse(localStorage.getItem(configMockKey) || '{"disabledWeeks": [], "activeDays": null, "classTimes": null, "bimesters": null, "activeDefaultScheduleId": null}');
        const academicWeeks = JSON.parse(localStorage.getItem('sqlite_mock_academic_weeks') || '[]');
        return { schedules, config, academicWeeks };
      }
      throw e;
    }
  },

  async checkStatus() {
    try {
      const res = await fetch(`${API_URL}/auth/me`, { headers: getHeaders(), credentials: 'same-origin' });
      if (!res.ok) return null;
      return await res.json(); 
    } catch (e) {
      return null;
    }
  },

  async fetchAdminMeta(userRole) {
    if (!isAdminLikeRole(userRole)) {
      return { disciplines: {}, academicYears: {}, subjectHours: {} };
    }
    try {
      const [discRes, yearsRes, subjRes] = await Promise.all([
        fetch(`${API_URL}/admin/disciplines`, { headers: getHeaders(), credentials: 'same-origin' }),
        fetch(`${API_URL}/admin/academic-years`, { headers: getHeaders(), credentials: 'same-origin' }),
        fetch(`${API_URL}/admin/subject-hours`, { headers: getHeaders(), credentials: 'same-origin' })
      ]);
      if (!discRes.ok || !yearsRes.ok || !subjRes.ok) throw new Error("API Meta Offline");
      return { 
        disciplines: await discRes.json(), 
        academicYears: await yearsRes.json(),
        subjectHours: await subjRes.json()
      };
    } catch (e) {
      if (canUseOfflineMocks()) {
        return {
          disciplines: JSON.parse(localStorage.getItem('sqlite_mock_disciplines') || '{}'),
          academicYears: JSON.parse(localStorage.getItem('sqlite_mock_academic_years') || '{}'),
          subjectHours: JSON.parse(localStorage.getItem('sqlite_mock_subject_hours') || '{}')
        };
      }
      throw e;
    }
  },
  
  async fetchAuditLogs() {
    try {
      const res = await fetch(`${API_URL}/admin/audit-logs`, { headers: getHeaders(), credentials: 'same-origin' });
      return res.ok ? await res.json() : [];
    } catch(e) { return []; }
  },

  async fetchConflictLogs() {
    try {
      const res = await fetch(`${API_URL}/admin/conflict-logs`, { headers: getHeaders(), credentials: 'same-origin' });
      return res.ok ? await res.json() : [];
    } catch(e) { return []; }
  },
  
  async saveDisciplineMeta(id, data) {
    try {
      const res = await fetch(`${API_URL}/admin/disciplines`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ id, ...data }) });
      if (!res.ok) throw new Error("Falha ao salvar disciplina");
    } catch (e) {
      throw e;
    }
  },

  async saveSubjectHours(id, totalHours) {
    try {
      const res = await fetch(`${API_URL}/admin/subject-hours`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ id, totalHours }) });
      if (!res.ok) throw new Error("Falha ao salvar carga horária");
    } catch (e) {
      throw e;
    }
  },

  async saveAcademicYearMeta(year, data) {
    try {
      const res = await fetch(`${API_URL}/admin/academic-years`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ year, ...data }) });
      if (!res.ok) throw new Error("Falha ao salvar ano letivo");
    } catch (e) {
      throw e;
    }
  },

  async checkSetup() {
    try {
      const res = await fetch(`${API_URL}/auth/setup`);
      if (!res.ok) throw new Error("API Auth Offline");
      return await res.json(); 
    } catch (e) {
      if (canUseOfflineMocks()) {
        const mockUsers = JSON.parse(localStorage.getItem('sqlite_mock_users') || '[]');
        return { needsSetup: mockUsers.length === 0 };
      }
      throw e;
    }
  },

  async setupAdmin(username, password) {
    try {
      const res = await fetch(`${API_URL}/auth/setup`, { method: 'POST', headers: getHeaders(), credentials: 'same-origin', body: JSON.stringify({ username, password }) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Falha na criação"); }
      return await res.json();
    } catch (e) {
      throw e;
    }
  },

  async login(username, password) {
    try {
      const res = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: getHeaders(), credentials: 'same-origin', body: JSON.stringify({ username, password }) });
      
      if (!res.ok) { 
        let errorMsg = "Credenciais inválidas";
        try {
          const text = await res.text();
          try {
            const err = JSON.parse(text); 
            errorMsg = err.error || errorMsg;
          } catch(e) {
            errorMsg = text || `Erro ${res.status}: ${res.statusText}`;
          }
        } catch (e) {
           errorMsg = `Erro ${res.status}: ${res.statusText}`;
        }
        throw new Error(errorMsg); 
      }
      
      return await res.json(); 
    } catch (e) {
      throw e;
    }
  },

  // Funções avulsas de alterar senha e cadastro independente deletadas conforme instrução

  async saveSingleSchedule(payload) {
    try {
      const res = await fetch(`${API_URL}/schedules/single`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) });
      if (!res.ok) {
        if(res.status === 401 || res.status === 403) throw new Error("Não autorizado. Faça login novamente.");
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error || "Falha na API");
      }
    } catch (e) {
      throw e;
    }
  },

  async saveSchedule(weekKey, dataObj) {
    try {
      const res = await fetch(`${API_URL}/schedules`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ id: weekKey, ...dataObj }) });
      if (!res.ok) {
        if(res.status === 401 || res.status === 403) throw new Error("Não autorizado. Faça login novamente.");
        throw new Error("Falha na API");
      }
    } catch (e) {
      throw e;
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
      throw e;
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
      throw e;
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
      if (canUseOfflineMocks() && e.message.includes("fetch")) {
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

  async fetchNotifications(siape, userRole) {
    try {
      const res = await fetch(`${API_URL}/notifications?siape=${siape || ''}&userRole=${userRole || ''}`);
      if (!res.ok) throw new Error("Falha ao carregar notificações");
      return await res.json();
    } catch(e) { return []; }
  },

  async markNotificationsRead(ids) {
    try {
      const res = await fetch(`${API_URL}/notifications/read`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ ids })
      });
      if (!res.ok) throw new Error("Falha ao marcar como lidas");
      return await res.json();
    } catch(e) {
      console.error(e);
      return { success: false };
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
      const res = await fetch(`${API_URL}/curriculum/${type}`);
      if (!res.ok) throw new Error(`Falha ao carregar ${type}`);
      return await res.json();
    } catch (e) {
      throw e;
    }
  },

  async saveCurriculum(type, data) {
    try {
      const res = await fetch(`${API_URL}/admin/curriculum/${type}`, { method: 'PUT', headers: getHeaders(), credentials: 'same-origin', body: JSON.stringify(data) });
      if (!res.ok) throw new Error(`Falha ao salvar ${type}`);
      return await res.json();
    } catch (e) {
      throw e;
    }
  },

  async deleteCurriculum(type, id) {
    try {
      const res = await fetch(`${API_URL}/admin/curriculum/${type}/${id}`, { method: 'DELETE', headers: getHeaders(), credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Falha ao remover ${type}`);
      return await res.json();
    } catch (e) {
      throw e;
    }
  },

  async fetchTeachers(userRole) {
    // Admins get the full list (with email, status, etc.)
    if (isAdminLikeRole(userRole)) {
      try {
        const res = await fetch(`${API_URL}/admin/teachers`, { headers: getHeaders(), credentials: 'same-origin' });
        if (!res.ok) throw new Error('Falha ao buscar professores');
        return await res.json();
      } catch (e) {
        throw e;
      }
    }
    // Public/aluno/professor: use the public endpoint (only name + siape, no sensitive data)
    try {
      const res = await fetch(`${API_URL}/teachers`);
      if (!res.ok) throw new Error('Falha ao buscar lista pública de professores');
      return await res.json();
    } catch (e) {
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
      throw e;
    }
  },

  async deleteTeacher(siape) {
    try {
      const res = await fetch(`${API_URL}/admin/teachers/${siape}`, { method: 'DELETE', headers: getHeaders() });
      if (!res.ok) throw new Error('Falha ao remover professor');
      return await res.json();
    } catch (e) {
      throw e;
    }
  },

  async updateAdminStatus(siape, is_admin) {
    try {
      const res = await fetch(`${API_URL}/admin/teachers/${siape}/admin-status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ is_admin })
      });
      if (!res.ok) throw new Error('Falha ao atualizar status de administrador');
      return await res.json();
    } catch (e) {
      throw e;
    }
  },

  // --- SOLICITAÇÕES DE MUDANÇA (PROMPT 2) ---
  async getRequests() {
    return this.fetchRequests();
  },
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
    const res = await fetch(`${API_URL}/requests`, {
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

  async updateRequestStatus(id, status, admin_feedback = '', system_message = '') {
    const res = await fetch(`${API_URL}/requests/${id}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status, admin_feedback, system_message })
    });
    if (!res.ok) throw new Error('Falha ao atualizar solicitação');
    return await res.json();
  },

  // --- MOTOR DE REGRAS DE HORÁRIO ---
  async fetchScheduleRules() {
    try {
      const res = await fetch(`${API_URL}/schedule-rules`, { headers: getHeaders(), credentials: 'same-origin' });
      if (!res.ok) throw new Error('Falha ao buscar regras do painel');
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async updateScheduleRule(id, data) {
    const res = await fetch(`${API_URL}/schedule-rules/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
       const err = await res.json().catch(() => ({}));
       throw new Error(err.error || err.message || 'Falha ao atualizar a regra');
    }
    return await res.json();
  }
};
