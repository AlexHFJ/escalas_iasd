import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { ADVENTIST_LOGO_BASE64 } from './adventistLogo';
import { RECEPCAO_IMAGE_BASE64 } from './recepcaoImage';

const DAY_NAME      = { 0: 'Dom', 3: 'Qua', 6: 'Sab' };
const DAY_NAME_FULL = { 0: 'Domingo', 3: 'Quarta-feira', 6: 'Sabado' };
const MONTHS_PT     = [
  'Janeiro','Fevereiro','Marco','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

export async function generateSchedulePDF({
  churchName, ministryLabel, periodLabel,
  ministry, dates, scheduleData,
  ministryImage, observations,
}) {
  const isRecepcao = ministry?.id === 'recepcao';
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  // ── Cabecalho ──────────────────────────────────────────────
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageW, 42, 'F');

  try { doc.addImage(ADVENTIST_LOGO_BASE64, 'PNG', margin - 2, 5, 30, 30); }
  catch (e) { console.warn('Erro logo:', e); }

  if (isRecepcao) {
    try { doc.addImage(RECEPCAO_IMAGE_BASE64, 'JPEG', 105, 2, 103, 38); }
    catch (e) { console.warn('Erro imagem recepcao:', e); }
  } else if (ministryImage) {
    try {
      const ext = ministryImage.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(ministryImage, ext, pageW - margin - 32, 4, 32, 32);
    } catch (e) { console.warn('Erro imagem:', e); }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(churchName || 'Igreja Adventista do Setimo Dia', 46, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Escala de ' + ministryLabel, 46, 23);
  doc.setFontSize(9);
  doc.setTextColor(180, 210, 255);
  doc.text(periodLabel, 46, 30);
  const today = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
  doc.setFontSize(6.5); doc.setTextColor(150, 190, 240);
  doc.text('Gerado em ' + today, isRecepcao ? 100 : pageW - margin, 38, { align: 'right' });

  let startY = 46;

  // ── Observacoes (nao-recepcao) ─────────────────────────────
  if (!isRecepcao && observations && observations.trim()) {
    doc.setFillColor(237, 242, 255); doc.setDrawColor(180, 200, 240);
    const obsLines = doc.splitTextToSize(observations, pageW - margin * 2 - 8);
    const obsH = obsLines.length * 5 + 12;
    doc.roundedRect(margin, startY, pageW - margin * 2, obsH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(30, 58, 95);
    doc.text('Observacoes:', margin + 4, startY + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(40, 60, 100);
    doc.text(obsLines, margin + 4, startY + 12);
    startY += obsH + 5;
  }

  function footer(data) {
    doc.setFontSize(6.5); doc.setTextColor(150, 150, 160);
    doc.text('Desenvolvido por Alex Fujimori', margin, pageH - 5);
    doc.text(churchName + ' — Escala de ' + ministryLabel + ' — ' + periodLabel,
      pageW / 2, pageH - 5, { align: 'center' });
    doc.text('Pagina ' + data.pageNumber, pageW - margin, pageH - 5, { align: 'right' });
  }

  // ══════════════════════════════════════════════════════════
  // RECEPCAO: cada mês dividido ao meio — pt1 esq | pt2 dir
  // Meses ficam empilhados verticalmente nesse formato
  // ══════════════════════════════════════════════════════════
  if (isRecepcao) {
    // Agrupa por mês
    const groups = [];
    for (const d of dates) {
      let g = groups.find(x => x.month === d.month);
      if (!g) { g = { month: d.month, monthName: MONTHS_PT[d.month], dates: [] }; groups.push(g); }
      g.dates.push(d);
    }

    const gap    = 6;                              // gap horizontal entre colunas
    const colW   = (pageW - margin * 2 - gap) / 2;
    const colX   = [margin, margin + colW + gap];  // X de cada coluna

    const headH  = 7.5;  // altura do cabeçalho da tabela
    const rowH   = 4.0;  // altura estimada de cada linha
    const titleH = 7.0;  // altura do título do mês

    let curY = startY; // Y atual (ambas colunas crescem juntas por mês)

    const tableHeadStyles = {
      fillColor: [180, 70, 95], textColor: [255, 255, 255],
      fontStyle: 'bold', fontSize: 7, halign: 'center',
      cellPadding: 1.5, lineWidth: 0.2,
    };
    const tableBodyStyles = {
      fontSize: 6.5, textColor: [20, 20, 40],
      cellPadding: 1.2, lineColor: [210, 190, 200], lineWidth: 0.15,
    };

    function drawMonthTable(x, y, rows, monthName, showTitle) {
      // Título do mês centralizado na coluna
      if (showTitle) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(150, 50, 75);
        doc.text(monthName, x + colW / 2, y + 4, { align: 'center' });
        doc.setDrawColor(180, 80, 100);
        doc.setLineWidth(0.35);
        doc.line(x, y + 5.5, x + colW, y + 5.5);
        y += titleH;
      }

      doc.autoTable({
        startY: y,
        head: [['Data', 'Dia', 'Rec. 1', 'Rec. 2']],
        body: rows,
        headStyles: tableHeadStyles,
        bodyStyles: tableBodyStyles,
        alternateRowStyles: { fillColor: [255, 240, 245] },
        tableLineColor: [200, 160, 175], tableLineWidth: 0.2,
        tableWidth: colW,
        margin: { left: x, right: pageW - x - colW },
        columnStyles: {
          0: { halign: 'center', cellWidth: colW * 0.28, fontStyle: 'bold' },
          1: { halign: 'center', cellWidth: colW * 0.20 },
          2: { cellWidth: colW * 0.26 },
          3: { cellWidth: colW * 0.26 },
        },
        didDrawPage: footer,
      });

      return doc.lastAutoTable.finalY;
    }

    for (const group of groups) {
      const allRows = group.dates.map(d => {
        const entry = scheduleData[d.id] || {};
        const isSab = d.dayOfWeek === 6;
        return [
          d.label.split(', ')[1] || d.label,
          DAY_NAME[d.dayOfWeek] || '',
          entry['recepcao_1'] || '—',
          isSab ? (entry['recepcao_2'] || '—') : '',
        ];
      });

      // Divide ao meio — pt1 esquerda, pt2 direita
      const half  = Math.ceil(allRows.length / 2);
      const rowsL = allRows.slice(0, half);
      const rowsR = allRows.slice(half);

      // Ambas as colunas começam no mesmo Y
      const yStart = curY;

      // Coluna esquerda — com título
      const bottomL = drawMonthTable(colX[0], yStart, rowsL, group.monthName, true);

      // Coluna direita — sem título (continuação do mesmo mês)
      const yR = yStart + titleH; // alinha com onde a tabela esquerda começa (abaixo do título)
      const bottomR = rowsR.length > 0
        ? drawMonthTable(colX[1], yR, rowsR, group.monthName, false)
        : yR;

      // Próximo mês começa abaixo da maior das duas colunas + gap
      curY = Math.max(bottomL, bottomR) + 5;
    }

    return doc.save('Escala_Recepcao_' + periodLabel.replace(/\s/g,'_') + '.pdf');
  }

  // ── Estilos padrão ─────────────────────────────────────────
  const headStyles = {
    fillColor: [201, 152, 58], textColor: [255, 255, 255],
    fontStyle: 'bold', fontSize: 10, halign: 'center',
    cellPadding: 4, lineColor: [160, 120, 40], lineWidth: 0.3,
  };
  const bodyStyles = {
    fontSize: 9.5, textColor: [20, 30, 50],
    cellPadding: 3.5, lineColor: [200, 210, 230], lineWidth: 0.25,
  };

  // ── Diaconato semanal ──────────────────────────────────────
  if (ministry?.isWeekly) {
    const fields = ministry.fields || [];
    doc.autoTable({
      startY,
      head: [['Periodo (Dom ao Sab)', ...fields.map(f => f.label)]],
      body: dates.map(w => {
        const entry = scheduleData[w.id] || {};
        return [w.label, ...fields.map(f => entry[f.id] || '—')];
      }),
      headStyles, bodyStyles,
      alternateRowStyles: { fillColor: [255, 248, 230] },
      tableLineColor: [200, 180, 130], tableLineWidth: 0.3,
      columnStyles: { 0: { halign: 'center', cellWidth: 50, fontStyle: 'bold' } },
      margin: { left: margin, right: margin },
      didDrawPage: footer,
    });
    return doc.save('Escala_Diaconato_' + periodLabel.replace(/\s/g,'_') + '.pdf');
  }

  // ── Musica e campos por dia ────────────────────────────────
  if (ministry?.fieldsByDay) {
    const allFields = ministry.fields;
    doc.autoTable({
      startY,
      head: [['Data', 'Dia', ...allFields.map(f => f.label)]],
      body: dates.map(d => {
        const entry = scheduleData[d.id] || {};
        const dayFieldIds = new Set((ministry.fieldsByDay[d.dayOfWeek] || []).map(f => f.id));
        return [
          d.label.split(', ')[1] || d.label, DAY_NAME_FULL[d.dayOfWeek] || '',
          ...allFields.map(f => dayFieldIds.has(f.id) ? (entry[f.id] || '—') : ''),
        ];
      }),
      headStyles, bodyStyles,
      alternateRowStyles: { fillColor: [235, 241, 255] },
      tableLineColor: [180, 190, 210], tableLineWidth: 0.3,
      columnStyles: {
        0: { halign: 'center', cellWidth: 26, fontStyle: 'bold' },
        1: { halign: 'center', cellWidth: 30 },
      },
      margin: { left: margin, right: margin },
      didDrawPage: footer,
    });
  } else {
    const fields = ministry?.fields || [];
    doc.autoTable({
      startY,
      head: [['Data', 'Dia', ...fields.map(f => f.label)]],
      body: dates.map(d => {
        const entry = scheduleData[d.id] || {};
        return [
          d.label.split(', ')[1] || d.label, DAY_NAME_FULL[d.dayOfWeek] || '',
          ...fields.map(f => entry[f.id] || '—'),
        ];
      }),
      headStyles, bodyStyles,
      alternateRowStyles: { fillColor: [235, 241, 255] },
      tableLineColor: [180, 190, 210], tableLineWidth: 0.3,
      columnStyles: {
        0: { halign: 'center', cellWidth: 26, fontStyle: 'bold' },
        1: { halign: 'center', cellWidth: 30 },
      },
      margin: { left: margin, right: margin },
      didDrawPage: footer,
    });
  }

  doc.save('Escala_' + ministryLabel.replace(/\s/g,'_') + '_' + periodLabel.replace(/\s/g,'_') + '.pdf');
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
