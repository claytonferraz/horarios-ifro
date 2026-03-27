import React from 'react';
import { 
  Users, 
  AlertCircle, 
  CheckCircle, 
  Zap, 
  TrendingUp, 
  Clock, 
  ArrowRight, 
  BarChart, 
  PieChart as PieChartIcon, 
  Activity,
  Layers,
  ArrowUpRight
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

const mockData = {
  kpis: { vagas: 14, pendentes: 5, extras: 8, ativosHoje: 42 },
  graficoVagas: [
    { curso: 'Informática', vagas: 8 }, 
    { curso: 'Química', vagas: 4 }, 
    { curso: 'Agropecuária', vagas: 2 },
    { curso: 'Alimentos', vagas: 3 },
    { curso: 'Edificações', vagas: 1 }
  ],
  graficoStatus: [
    { name: 'Aprovadas', value: 65, fill: '#10b981' }, 
    { name: 'Pendentes', value: 15, fill: '#f59e0b' }, 
    { name: 'Recusadas', value: 20, fill: '#f43f5e' }
  ],
  fila: [
    { id: 1, prof: 'João Silva', tipo: 'Permuta', turma: '2A INF', tempo: 'Há 10 min', status: 'pendente' },
    { id: 2, prof: 'Maria Souza', tipo: 'Lançamento Extra', turma: '1B QUI', tempo: 'Há 2 horas', status: 'pendente' },
    { id: 3, prof: 'Carlos Menezes', tipo: 'Assumir Vaga', turma: '3C AGRO', tempo: 'Há 5 horas', status: 'pendente' }
  ],
  timeline: [
    { id: 1, text: "Professor João Silva assumiu vaga na turma 2A INF", time: "Há 12 min", icon: <CheckCircle size={14} className="text-emerald-500" /> },
    { id: 2, text: "Nova solicitação de permuta enviada por Maria Souza", time: "Há 45 min", icon: <AlertCircle size={14} className="text-amber-500" /> },
    { id: 3, text: "Configuração da Semana 12 finalizada por Admin", time: "Há 2 horas", icon: <Zap size={14} className="text-blue-500" /> }
  ]
};

export const CommandCenterDashboard = ({ isDarkMode }) => {
  return (
    <div className={`flex flex-col gap-8 p-4 md:p-8 animate-in fade-in duration-700`}>
      
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
              Semana 11
            </span>
          </div>
        </div>

        <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border ${isDarkMode ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-100 shadow-sm"}`}>
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? "text-emerald-400" : "text-emerald-700"}`}>
            Sistema Online
          </span>
        </div>
      </header>

      {/* Fileira 1: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          icon={<AlertCircle className="text-rose-500" />} 
          label="Aulas a Definir" 
          value={mockData.kpis.vagas} 
          sub="Vagas sem professor"
          color="rose"
          isDarkMode={isDarkMode}
        />
        <KPICard 
          icon={<Clock className="text-amber-500" />} 
          label="Aprovações Pendentes" 
          value={mockData.kpis.pendentes} 
          sub="Aguardando DAPE"
          color="amber"
          isDarkMode={isDarkMode}
        />
        <KPICard 
          icon={<Zap className="text-emerald-500" />} 
          label="Aulas Extras" 
          value={mockData.kpis.extras} 
          sub="Aprovadas na semana"
          color="emerald"
          isDarkMode={isDarkMode}
        />
        <KPICard 
          icon={<Users className="text-blue-500" />} 
          label="Professor Ativos" 
          value={mockData.kpis.ativosHoje} 
          sub="Docentes com aula hoje"
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
              <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? "text-white" : "text-slate-800"}`}>Vagas por Curso</h3>
            </div>
            <button className={`p-2 rounded-xl text-xs font-bold transition-colors ${isDarkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-50 text-slate-500"}`}>
              Ver Tudo
            </button>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={mockData.graficoVagas} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
          </div>
        </div>

        {/* Gráfico de Rosca: Status */}
        <div className={`p-6 rounded-[2.5rem] border backdrop-blur-md transition-all ${isDarkMode ? "bg-slate-900/50 border-slate-800 hover:border-slate-700 shadow-2xl" : "bg-white border-slate-100 shadow-xl shadow-slate-200/50"}`}>
          <div className="flex items-center gap-3 mb-8">
            <div className={`p-2 rounded-xl ${isDarkMode ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
              <PieChartIcon size={20} />
            </div>
            <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? "text-white" : "text-slate-800"}`}>Status das Solicitações</h3>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={mockData.graficoStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {mockData.graficoStatus.map((entry, index) => (
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
          </div>
          <div className="mt-4 flex justify-around">
             {mockData.graficoStatus.map(s => (
               <div key={s.name} className="text-center">
                 <p className="text-[10px] font-black uppercase tracking-tighter text-slate-500">{s.name}</p>
                 <p className={`text-lg font-black ${isDarkMode ? "text-white" : "text-slate-900"}`}>{s.value}%</p>
               </div>
             ))}
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
              <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? "text-white" : "text-slate-800"}`}>Fila Expressa (Inbox)</h3>
            </div>
          </div>
          <div className="space-y-4">
            {mockData.fila.map((item) => (
              <div 
                key={item.id} 
                className={`group flex items-center justify-between p-5 rounded-3xl border transition-all ${isDarkMode ? "bg-slate-800/50 border-slate-700 hover:bg-slate-800" : "bg-slate-50 border-transparent hover:bg-white hover:border-slate-200 hover:shadow-lg hover:shadow-slate-200/40"}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${isDarkMode ? "bg-slate-900 text-slate-400" : "bg-white text-slate-500 shadow-sm"}`}>
                    {item.id}
                  </div>
                  <div>
                    <h4 className={`text-xs font-black ${isDarkMode ? "text-white" : "text-slate-800"}`}>{item.prof}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] font-bold uppercase ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{item.tipo}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-400" />
                      <span className={`text-[9px] font-black uppercase text-blue-500`}>{item.turma}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`hidden md:block text-[9px] font-bold text-slate-500`}>{item.tempo}</span>
                  <button className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all`}>
                    Analisar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Log de Atividades Recentes */}
        <div className={`p-6 rounded-[2.5rem] border backdrop-blur-md transition-all ${isDarkMode ? "bg-slate-900/50 border-slate-800 shadow-2xl" : "bg-white border-slate-100 shadow-xl shadow-slate-200/50"}`}>
          <div className="flex items-center gap-3 mb-8">
            <div className={`p-2 rounded-xl ${isDarkMode ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
              <Layers size={20} />
            </div>
            <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? "text-white" : "text-slate-800"}`}>Log de Atividades</h3>
          </div>
          <div className="space-y-6 relative ml-3">
             <div className={`absolute left-[7px] top-2 bottom-2 w-0.5 rounded-full ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`} />
             {mockData.timeline.map((log) => (
               <div key={log.id} className="relative flex gap-4 items-start">
                 <div className={`relative z-10 w-4 h-4 rounded-full flex items-center justify-center border-2 ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
                   {log.icon}
                 </div>
                 <div className="flex-1 -mt-1">
                   <p className={`text-[11px] font-medium leading-relaxed ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                     {log.text}
                   </p>
                   <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mt-1 block">
                     {log.time}
                   </span>
                 </div>
               </div>
             ))}
          </div>
          <button className={`w-full mt-8 py-4 rounded-2xl border-2 border-dashed transition-all hover:border-solid ${isDarkMode ? "border-slate-800 hover:border-slate-600 hover:bg-slate-800/30 text-slate-500" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-400"} text-[10px] font-bold uppercase tracking-widest`}>
            Ver Log Completo
          </button>
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
