export const handlePrint = ({
  scheduleMode,
  viewMode,
  selectedClass,
  selectedDay,
  selectedTeacher,
  selectedWeek
}) => {
  const printArea = document.getElementById('printable-area');
  if (!printArea) return;
  
  const printContent = printArea.innerHTML;
  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  
  if (!printWindow) {
    alert("O bloqueador de pop-ups impediu a abertura da aba de impressão. Permita pop-ups para este site e tente novamente.");
    return;
  }

  const labelType = scheduleMode === 'padrao' ? 'HORÁRIO PADRÃO' : scheduleMode === 'previa' ? 'PRÉVIA DA PRÓXIMA SEMANA' : 'HORÁRIO CONSOLIDADO';
  const printTitle = viewMode === 'total' ? 'Diário de Classe Detalhado' : viewMode === 'sem_professor' ? 'Relatório de Aulas Vagas' : viewMode === 'curso' ? `Horário dos Cursos` : viewMode === 'turma' ? `Horário da Turma: ${selectedClass}` : viewMode === 'hoje' ? `Horário do Dia (${selectedDay}): ${selectedClass}` : `Horário do Professor: ${selectedTeacher}`;
  const printSubtitle = (viewMode === 'total' || viewMode === 'sem_professor') ? `Documento Oficial` : scheduleMode === 'padrao' ? `BASE DE REFERÊNCIA` : `[${labelType}] - ${selectedWeek}`;

  const isMatrixView = viewMode !== 'total' && viewMode !== 'hoje';
  const bodyForceCSS = isMatrixView ? `height: 98vh; overflow: hidden; box-sizing: border-box; zoom: 0.95;` : ``;
  const tableForceCSS = isMatrixView ? `height: auto; max-height: 85vh;` : ``;
  
  const columnForceCSS = viewMode === 'curso' || viewMode === 'sem_professor' || viewMode === 'professor' ? `
    th:nth-child(1), td:nth-child(1) { width: 35px !important; }
    th:nth-child(2), td:nth-child(2) { width: 60px !important; }
  ` : isMatrixView ? `
    th:first-child, td:first-child { width: 60px !important; }
  ` : ``;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Impressão - ${printTitle}</title>
        <style>
          @page { size: A4 landscape; margin: 5mm; }
          body { 
            background-color: #fff; 
            color: #000; 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 5px; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
            ${bodyForceCSS}
          }
          
          .doc-header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 5px; }
          .doc-header h2 { font-size: 16px; text-transform: uppercase; margin: 0 0 3px 0; letter-spacing: 1px; }
          .doc-header p { font-size: 11px; font-weight: bold; color: #444; margin: 0; }

          .no-print, button, select, input { display: none !important; }
          
          table { 
            width: 100%; 
            ${tableForceCSS}
            border-collapse: collapse; 
            margin-top: 5px; 
            table-layout: fixed; 
            page-break-inside: avoid;
            margin-bottom: 20px;
          }
          th, td { 
            border: 1px solid #000; 
            padding: 2px 1px !important; 
            text-align: center; 
            vertical-align: middle; 
            font-size: 9px !important; 
            overflow: hidden; 
            word-wrap: break-word;
          }
          th { background-color: #eaeaea !important; font-weight: bold; text-transform: uppercase; font-size: 10px !important; }
          
          ${columnForceCSS}
          
          .print-clean-card { padding: 0 !important; margin: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; }
          .print-clean-card p, .print-clean-card span { margin: 1px 0; color: #000 !important; }
          
          .print-clean-card .subject { font-weight: normal !important; font-size: 10px !important; } 
          .print-clean-card .details { font-size: 8px !important; color: #222 !important; }
          
          .print-interval th, .print-interval td { background-color: #f0f0f0 !important; font-weight: bold; font-size: 8px !important; letter-spacing: 1px; text-align: center; height: 10px !important; padding: 0 !important; }
          
          svg { display: none !important; }
          tr { page-break-inside: avoid; }
          
          .vertical-text-wrapper {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            height: 100% !important;
            width: 100% !important;
          }
          .vertical-text-wrapper span {
            transform: rotate(-90deg) !important;
            display: block !important;
            white-space: nowrap !important;
          }
        </style>
      </head>
      <body>
        <div class="doc-header">
          <h2>${printTitle}</h2>
          <p>${printSubtitle}</p>
        </div>
        ${printContent}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 400);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close(); 
};
