import React, { useMemo } from 'react';
import { 
  Users, 
  AlertCircle, 
  CheckCircle, 
  Zap, 
  TrendingUp, 
  Clock, 
  BarChart, 
  PieChart as PieChartIcon, 
  Activity,
  Layers,
  History,
  ShieldAlert
} from 'lucide-react';
import { 
  BarChart as ReBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { useData } from '@/contexts/DataContext';
import { isTeacherPending } from '@/lib/dates';

export const CommandCenterDashboard = ({ isDarkMode }) => {
  const { rawData, requests, academicYearsMeta, selectedConfigYear, auditLogs, conflictLogs } = useData();

  // 1. Processamento de Dados Reais
  const analytics = useMemo(() => {
    // KPIs
    const vacancies = rawData.filter(s => isTeacherPending(s.teacher));
    const pendingReqs = requests.filter(r => r.status === 'pendente');
    
    // Contagem de professores ativos (unique siapies)
    const activeTeachersSiapies = new Set(
      rawData
        .filter(s => !isTeacherPending(s.teacher))
        .map(s => s.teacher)
    );

    // Gráfico de Vagas por Curso
    const vacanciesByCourse = {};
    vacancies.forEach(v => {
      const course = v.course || 'Outros';
      vacanciesByCourse[course] = (vacanciesByCourse[course] || 0) + 1;
    });
    const barData = Object.entries(vacanciesByCourse)
      .map(([curso, count]) => ({ curso, vagas: count }))
      .sort((a, b) => b.vagas - a.vagas)
      .slice(0, 5);

    // Gráfico de Status de Solicitações
    const statusCounts = {
      'Aprovadas': requests.filter(r => r.status === 'aprovada').length,
      'Pendentes': requests.filter(r => r.status === 'pendente').length,
      'Recusadas': requests.filter(r => r.status === 'recusada' || r.status === 'cancelada').length,
    };
    const pieData = [
      { name: 'Aprovadas', value: statusCounts.Aprovadas, fill: '#10b981' },
      { name: 'Pendentes', value: statusCounts.Pendentes, fill: '#f59e0b' },
      { name: 'Recusadas', value: statusCounts.Recusadas, fill: '#f43f5e' }
    ].filter(d => d.value > 0);

    // Timeline de atividades (usando Auditoria se houver, senão Solicitações)
    const timeline = (auditLogs?.length > 0 ? auditLogs : requests).slice(0, 6).map(item => {
      const isAudit = !!item.action;
      return {
        id: item.id,
        text: isAudit ? `${item.action}: ${item.details || ''}` : `${item.requesterName || item.requesterSiape} solicitou ${item.type}`,
        time: item.timestamp || item.createdAt || new Date().toISOString(),
        icon: isAudit ? <History size={14} className="text-blue-500" /> : <Activity size={14} className="text-amber-500" />
      };
    });

    // Cumprimento do Calendário
    const yearMeta = academicYearsMeta[selectedConfigYear] || { currentDays: 0, totalDays: 200 };
    const calendarProgress = yearMeta.totalDays > 0 ? Math.round((yearMeta.currentDays / yearMeta.totalDays) * 100) : 0;

    return {
      kpis: {
        vagas: vacancies.length,
        pendentes: pendingReqs.length,
        conflitos: conflictLogs?.length || 0,
        ativosHoje: activeTeachersSiapies.size,
        progressoLetivo: calendarProgress
      },
      barData,
      pieData,
      timeline,
      requestsInbox: requests.filter(r => r.status === 'pendente').slice(0, 5)
    };
  }, [rawData, requests, academicYearsMeta, selectedConfigYear, auditLogs, conflictLogs]);

  return (
    <div className={`flex flex-col gap-8 animate-in fade-in duration-700`}>
      
      {/* Header Dinâmico */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className={`text-2xl md:text-3xl font-black tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            Olá, Gestão. 👋
          </h1>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Bem-vindo ao Centro de Comando.
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-400" />
            <span className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>
              Configuração {selectedConfigYear}
            </span>
          </div>
        </div>

        <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border ${isDarkMode ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-100 shadow-sm"}`}>
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? "text-emerald-400" : "text-emerald-700"}`}>
            Monitoramento Ativo
          </span>
        </div>
      </header>

      {/* Fileira 1: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          icon={<AlertCircle className="text-rose-500" />} 
          label="Aulas a Definir" 
          value={analytics.kpis.vagas} 
          sub="Vagas no sistema"
          color="rose"
          isDarkMode={isDarkMode}
        />
        <KPICard 
          icon={<Clock className="text-amber-500" />} 
          label="Solicitações" 
          value={analytics.kpis.pendentes} 
          sub="Aguardando análise"
          color="amber"
          isDarkMode={isDarkMode}
        />
        <KPICard 
          icon={<Zap className="text-emerald-500" />} 
          label="Progresso Letivo" 
          value={`${analytics.kpis.progressoLetivo}%`} 
          sub="Dias letivos cumpridos"
          color="emerald"
          isDarkMode={isDarkMode}
        />
        <KPICard 
          icon={<ShieldAlert className="text-blue-500" />} 
          label="Conflitos" 
          value={analytics.kpis.conflitos} 
          sub="Alertas detectados"
          color="blue"
          isDarkMode={isDarkMode}
        />
      </div>

      {/* Fileira 2: Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Barras: Vagas por Curso */}
        <div className={`lg:col-span-2 p-6 rounded-[2.5rem] border backdrop-blur-md transition-all ${isDarkMode ? "bg-slate-900/50 border-slate-800 hover:border-slate-700 shadow-2xl" : "bg-white border-slate-100 shadow-xl shadow-slate-200/50"}`}>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${isDarkMode ? "bg-rose-500/10 text-rose-400" : "bg-rose-50 text-rose-600"}`}>
                <BarChart size={20} />
              </div>
              <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? "text-white" : "text-slate-800"}`}>Ocupação por Curso (Vagas)</h3>
            </div>
          </div>
          <div className="h-[300px] w-full">
            {analytics.barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart data={analytics.barData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                  <XAxis 
                    dataKey="curso" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: isDarkMode ? "#94a3b8" : "#64748b" }} 
                    dy={10}
                  />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{ fill: isDarkMode ? "#1e293b" : "#f1f5f9" }}
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? "#0f172a" : "#fff", 
                      borderRadius: "1rem", 
                      border: "none", 
                      boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" 
                    }}
                    labelStyle={{ fontWeight: 900, color: isDarkMode ? "#fff" : "#000" }}
                  />
                  <Bar 
                    dataKey="vagas" 
                    fill={isDarkMode ? "#f43f5e" : "#e11d48"} 
                    radius={[8, 8, 0, 0]} 
                    barSize={40} 
                  />
                </ReBarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full opacity-40">
                <CheckCircle size={48} className="mb-2" />
                <p className="text-xs font-black uppercase tracking-widest">Nenhuma aula vaga detectada</p>
              </div>
            )}
          </div>
        </div>

        {/* Gráfico de Rosca: Status */}
        <div className={`p-6 rounded-[2.5rem] border backdrop-blur-md transition-all ${isDarkMode ? "bg-slate-900/50 border-slate-800 hover:border-slate-700 shadow-2xl" : "bg-white border-slate-100 shadow-xl shadow-slate-200/50"}`}>
          <div className="flex items-center gap-3 mb-8">
            <div className={`p-2 rounded-xl ${isDarkMode ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
              <PieChartIcon size={20} />
            </div>
            <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? "text-white" : "text-slate-800"}`}>Solicitações</h3>
          </div>
          <div className="h-[250px] w-full">
            {analytics.pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {analytics.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? "#0f172a" : "#fff", 
                      borderRadius: "1rem", 
                      border: "none" 
                    }}
                  />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full opacity-40">
                <Clock size={48} className="mb-2" />
                <p className="text-xs font-black uppercase tracking-widest text-center">Nenhuma solicitação<br/>no sistema</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fileira 3: Widgets Operacionais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Fila Expressa (Inbox) */}
        <div className={`p-6 rounded-[2.5rem] border backdrop-blur-md transition-all ${isDarkMode ? "bg-slate-900/50 border-slate-800 shadow-2xl" : "bg-white border-slate-100 shadow-xl shadow-slate-200/50"}`}>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${isDarkMode ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                <Activity size={20} />
              </div>
              <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? "text-white" : "text-slate-800"}`}>Fila de Pendências</h3>
            </div>
          </div>
          <div className="space-y-4">
            {analytics.requestsInbox.length > 0 ? (
              analytics.requestsInbox.map((item) => (
                <div 
                  key={item.id} 
                  className={`group flex items-center justify-between p-5 rounded-3xl border transition-all ${isDarkMode ? "bg-slate-800/50 border-slate-700 hover:bg-slate-800" : "bg-slate-50 border-transparent hover:bg-white hover:border-slate-200 hover:shadow-lg hover:shadow-slate-200/40"}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] ${isDarkMode ? "bg-slate-900 text-slate-400" : "bg-white text-slate-500 shadow-sm"}`}>
                      #{String(item.id).slice(-3)}
                    </div>
                    <div>
                      <h4 className={`text-xs font-black ${isDarkMode ? "text-white" : "text-slate-800"}`}>
                        {item.requesterName || item.requesterSiape}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] font-bold uppercase ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{item.type}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-400" />
                        <span className={`text-[9px] font-black uppercase text-blue-500`}>{item.className || 'Turma'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`hidden md:block text-[9px] font-bold text-slate-500`}>Pendente</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center opacity-40">
                <p className="text-[10px] font-black uppercase tracking-widest">Nada para aprovar no momento</p>
              </div>
            )}
          </div>
        </div>

        {/* Log de Atividades Recentes */}
        <div className={`p-6 rounded-[2.5rem] border backdrop-blur-md transition-all ${isDarkMode ? "bg-slate-900/50 border-slate-800 shadow-2xl" : "bg-white border-slate-100 shadow-xl shadow-slate-200/50"}`}>
          <div className="flex items-center gap-3 mb-8">
            <div className={`p-2 rounded-xl ${isDarkMode ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
              <Layers size={20} />
            </div>
            <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? "text-white" : "text-slate-800"}`}>Rastro de Auditoria</h3>
          </div>
          <div className="space-y-6 relative ml-3">
             <div className={`absolute left-[7px] top-2 bottom-2 w-0.5 rounded-full ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`} />
             {analytics.timeline.length > 0 ? (
               analytics.timeline.map((log) => (
                <div key={log.id} className="relative flex gap-4 items-start">
                  <div className={`relative z-10 w-4 h-4 rounded-full flex items-center justify-center border-2 ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
                    {log.icon}
                  </div>
                  <div className="flex-1 -mt-1">
                    <p className={`text-[11px] font-medium leading-relaxed ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                      {log.text}
                    </p>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mt-1 block">
                      {new Date(log.time).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
             ) : (
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center py-10">Nenhuma atividade registrada</p>
             )}
          </div>
        </div>

      </div>

    </div>
  );
};

// Subcomponente: Card de KPI
const KPICard = ({ icon, label, value, sub, color, isDarkMode }) => {
  const colorSchemes = {
    rose: isDarkMode ? "bg-rose-500/10 border-rose-500/20 shadow-rose-900/10" : "bg-rose-50 border-rose-100 shadow-rose-100/50",
    amber: isDarkMode ? "bg-amber-500/10 border-amber-500/20 shadow-amber-900/10" : "bg-amber-50 border-amber-100 shadow-amber-100/50",
    emerald: isDarkMode ? "bg-emerald-500/10 border-emerald-500/20 shadow-emerald-900/10" : "bg-emerald-50 border-emerald-100 shadow-emerald-100/50",
    blue: isDarkMode ? "bg-blue-500/10 border-blue-500/20 shadow-blue-900/10" : "bg-blue-50 border-blue-100 shadow-blue-100/50",
  };

  return (
    <div className={`group p-6 rounded-[2rem] border backdrop-blur-md transition-all hover:scale-[1.03] ${colorSchemes[color]} ${isDarkMode ? "hover:border-slate-400/30" : "hover:border-slate-300"} shadow-xl`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${isDarkMode ? "bg-black/20" : "bg-white shadow-sm"}`}>
          {React.cloneElement(icon, { size: 20 })}
        </div>
        <div className={`p-1.5 rounded-lg text-[10px] ${isDarkMode ? "bg-white/5 text-white" : "bg-white/50 text-black"} opacity-0 group-hover:opacity-100 transition-opacity`}>
          <TrendingUp size={12} />
        </div>
      </div>
      <div>
        <h3 className={`text-4xl font-black tracking-tighter mb-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
          {value}
        </h3>
        <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {label}
        </p>
        <div className="flex items-center gap-1.5">
           <span className={`text-[9px] font-medium opacity-60 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
             {sub}
           </span>
        </div>
      </div>
    </div>
  );
};
