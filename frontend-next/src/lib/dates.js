export const DAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export const MAP_DAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export function getWeekBoundaries() {
  const now = new Date();
  now.setHours(0,0,0,0);
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek + 1); 
  const end = new Date(start);
  end.setDate(start.getDate() + 6); 
  end.setHours(23,59,59,999);
  const nextStart = new Date(end);
  nextStart.setTime(end.getTime() + 1); 
  const nextEnd = new Date(nextStart);
  nextEnd.setDate(nextStart.getDate() + 6); 
  nextEnd.setHours(23,59,59,999);
  return { start, end, nextStart, nextEnd };
}

export function parseRecordDate(dateStr, yearStr) {
  if (!dateStr) return null;
  const [d, m] = dateStr.split('/');
  if (!d || !m) return null;
  return new Date(parseInt(yearStr || new Date().getFullYear()), parseInt(m) - 1, parseInt(d), 12, 0, 0);
}

export function isDatePastOrToday(dateStr, yearStr) {
  const recordDate = parseRecordDate(dateStr, yearStr);
  if (!recordDate) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return recordDate <= today;
}

export function isCurrentWeek(dateStr, yearStr) {
  const recordDate = parseRecordDate(dateStr, yearStr);
  if (!recordDate) return false;
  const { start, end } = getWeekBoundaries();
  return recordDate >= start && recordDate <= end;
}

export function isNextWeek(dateStr, yearStr) {
  const recordDate = parseRecordDate(dateStr, yearStr);
  if (!recordDate) return false;
  const { nextStart, nextEnd } = getWeekBoundaries();
  return recordDate >= nextStart && recordDate <= nextEnd;
}

export function isCurrentOrNextWeek(dateStr, yearStr) {
  const recordDate = parseRecordDate(dateStr, yearStr);
  if (!recordDate) return true; // fallback for Padrão Anual
  const { start, nextEnd } = getWeekBoundaries();
  return recordDate >= start && recordDate <= nextEnd;
}

export function isFutureWeek(dateStr, yearStr) {
  const recordDate = parseRecordDate(dateStr, yearStr);
  if (!recordDate) return false;
  const { end } = getWeekBoundaries();
  return recordDate > end; 
}

export function isTeacherPending(teacher) {
  return !teacher || teacher === 'A Definir' || teacher === '0000001' || /vaga|sem professor/i.test(teacher) || teacher === '-';
}

export function resolveTeacherName(siapeOrName, globalTeachersList = []) {
  if (isTeacherPending(siapeOrName)) return 'AULA VAGA';
  if (!siapeOrName) return '-';
  
  // Suporte a múltiplos SIAPEs separados por vírgula
  const parts = String(siapeOrName).split(',').map(p => p.trim());
  
  if (parts.length > 1) {
    return parts.map(p => {
       if (isTeacherPending(p)) return 'VAGA';
       if (!globalTeachersList || !Array.isArray(globalTeachersList)) return p;
       const teacher = globalTeachersList.find(t => String(t.siape) === String(p) || String(t.id) === String(p));
       return teacher ? (teacher.nome_exibicao || teacher.nome_completo || p) : p;
    }).join(' / ');
  }

  if (!globalTeachersList || !Array.isArray(globalTeachersList)) return siapeOrName;
  const teacher = globalTeachersList.find(t => String(t.siape) === String(siapeOrName) || String(t.id) === String(siapeOrName));
  return teacher ? (teacher.nome_exibicao || teacher.nome_completo || teacher.siape) : siapeOrName;
}

export function getColorHash(str, isDark) {
  if (!str) return isDark ? 'bg-slate-900 text-transparent' : 'bg-slate-50 text-transparent';
  
  const lightColors = [
    'bg-blue-100 text-blue-800 border-blue-200', 'bg-green-100 text-green-800 border-green-200',
    'bg-purple-100 text-purple-800 border-purple-200', 'bg-amber-100 text-amber-800 border-amber-200',
    'bg-rose-100 text-rose-800 border-rose-200', 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'bg-teal-100 text-teal-800 border-teal-200', 'bg-orange-100 text-orange-800 border-orange-200',
  ];

  const darkColors = [
    'bg-blue-900/40 text-blue-200 border-blue-800/50', 'bg-green-900/40 text-green-200 border-green-800/50',
    'bg-purple-900/40 text-purple-200 border-purple-800/50', 'bg-amber-900/40 text-amber-200 border-amber-800/50',
    'bg-rose-900/40 text-rose-200 border-rose-800/50', 'bg-indigo-900/40 text-indigo-200 border-indigo-800/50',
    'bg-teal-900/40 text-teal-200 border-teal-800/50', 'bg-orange-900/40 text-orange-200 border-orange-800/50',
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % lightColors.length;
  
  return isDark ? darkColors[index] : lightColors[index];
}
