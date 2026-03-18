export const readFileAsync = (file) => new Promise((res, rej) => {
  const reader = new FileReader();
  reader.onload = e => res(e.target.result);
  reader.onerror = e => rej(new Error("Falha ao ler o arquivo selecionado."));
  reader.readAsText(file, 'UTF-8');
});

export const parseCSV = (csvText, fileName) => {
  const firstLineMatch = csvText.match(/^[^\r\n]+/);
  const firstLine = firstLineMatch ? firstLineMatch[0] : '';
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  
  const lines = [];
  let currentLine = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      if (inQuotes && csvText[i + 1] === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentLine.push(currentCell.replace(/\s+/g, ' ').trim()); 
      currentCell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && csvText[i + 1] === '\n') i++;
      currentLine.push(currentCell.replace(/\s+/g, ' ').trim());
      if (currentLine.some(c => c !== '')) lines.push(currentLine); 
      currentLine = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentCell !== '' || currentLine.length > 0) {
    currentLine.push(currentCell.replace(/\s+/g, ' ').trim());
    if (currentLine.some(c => c !== '')) lines.push(currentLine);
  }

  if (lines.length < 5) throw new Error("Arquivo inválido, formato não suportado ou vazio.");

  let weekName = fileName.replace('.csv', '').replace('Horário Técnico 2026 - ', '').replace('Horário Técnico 2026.xlsx - ', '').trim();
  for(let i=0; i<Math.min(10, lines.length); i++) {
      const cell = lines[i].find(c => c && /\d{2}\/\d{2}/.test(c));
      if (cell) { weekName = cell.trim(); break; }
  }

  const newRecords = [];
  const seenInFile = new Set();
  let currentClassCols = [], currentDay = '', currentDate = '', currentGlobalCourse = '';
  
  const normalizeStr = (str) => (str || '').toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    if (row.length < 3) continue;
    const col0 = normalizeStr(row[0]), col2 = normalizeStr(row[2]);

    if (col0.includes('HORARIO DE AULAS') || col0.includes('TECNICO EM')) {
      if (col0.includes('FLORESTAS')) currentGlobalCourse = 'TÉCNICO EM FLORESTAS';
      else if (col0.includes('INFORMATICA')) currentGlobalCourse = 'TÉCNICO EM INFORMÁTICA';
      else if (col0.includes('QUIMICA') || col0.includes('QUI')) currentGlobalCourse = 'TÉCNICO EM QUÍMICA';
      continue;
    }

    if (col0 === 'DIA' || col2.includes('HOR') || (col0 === '' && col2.includes('HORARIO'))) {
      currentClassCols = []; currentDay = ''; currentDate = '';
      for (let c = 3; c < row.length; c++) {
        let cellStr = row[c];
        if (cellStr) {
          let parts = cellStr.split('-');
          let className = parts[0].trim();
          let room = parts.slice(1).join('-').trim();
          if (currentGlobalCourse) currentClassCols.push({ index: c, className, room, course: currentGlobalCourse });
        }
      }
      continue;
    }

    if (currentClassCols.length > 0) {
      if (col0 !== '') {
        if (col0.includes('SEGUNDA') || col0.includes('1900-01-02')) currentDay = 'Segunda-feira';
        else if (col0.includes('TERCA') || col0.includes('1900-01-03')) currentDay = 'Terça-feira';
        else if (col0.includes('QUARTA') || col0.includes('1900-01-04')) currentDay = 'Quarta-feira';
        else if (col0.includes('QUINTA') || col0.includes('1900-01-05')) currentDay = 'Quinta-feira';
        else if (col0.includes('SEXTA') || col0.includes('1900-01-06')) currentDay = 'Sexta-feira';
        else if (col0.includes('SABADO') || col0.includes('1900-01-07')) currentDay = 'Sábado';
        
        let rawDate = row[1]?.trim() || ''; 
        const matchDate = rawDate.match(/(\d{1,2})[\/\-](\d{1,2})/);
        if (matchDate) {
          currentDate = `${matchDate[1].padStart(2, '0')}/${matchDate[2].padStart(2, '0')}`;
        } else if (rawDate) {
          currentDate = rawDate;
        }
      }
      
      const time = row[2]?.trim();
      if (!time || !time.includes('-')) continue;

      const timeParts = time.split('-');
      const startTime = timeParts[0]?.trim() || '';
      const endTime = timeParts[1]?.trim() || '';

      currentClassCols.forEach(col => {
        const cell = row[col.index]?.trim();
        if (cell && cell !== '-' && cell !== '') {
          let parts = cell.split('-');
          let teacher = parts.pop().replace(/\s+/g, ' ').trim();
          let subject = parts.join('-').replace(/\s+/g, ' ').trim();
          if (!teacher) teacher = "A Definir";
          if (!subject) { subject = teacher; teacher = "A Definir"; }

          const uniqueKey = `${currentDay}|${time}|${col.className}|${subject}`;
          if (seenInFile.has(uniqueKey)) return;
          seenInFile.add(uniqueKey);

          let year = "2026";
          const yearMatch = currentDate.match(/20\d{2}/);
          if (yearMatch) year = yearMatch[0];

          let month = "";
          let dayOfMonth = "";
          const dateMatch = currentDate.match(/(\d{2})\/(\d{2})/);
          if (dateMatch) {
            dayOfMonth = dateMatch[1]; 
            month = dateMatch[2]; 
          }

          const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);

          newRecords.push({
            id: uniqueId,
            fileName: fileName,
            week: weekName, 
            day: currentDay, 
            date: currentDate, 
            dayOfMonth: dayOfMonth,
            month: month,
            year: year,
            time: time,
            startTime: startTime,
            endTime: endTime,
            className: col.className, 
            room: col.room, 
            course: col.course, 
            subject: subject, 
            teacher: teacher
          });
        }
      });
    }
  }
  return newRecords;
};
