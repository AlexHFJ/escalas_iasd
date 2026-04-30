import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { ADVENTIST_LOGO_BASE64 } from './adventistLogo';
import { RECEPCAO_IMAGE_BASE64 } from './recepcaoImage';

const DAY_NAME = { 0: 'Dom', 3: 'Qua', 6: 'Sab' };
const DAY_NAME_FULL = { 0: 'Domingo', 3: 'Quarta-feira', 6: 'Sabado' };

const MONTHS_PT = [
  'Janeiro','Fevereiro','Marco','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

export async function generateSchedulePDF({
  churchName, ministryLabel, periodLabel,
  ministry, dates, scheduleData,
  ministryImage, observations,
}) {
  const isRecepcao = ministry?.id === 'recepcao';
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();  // 210mm
  const pageH = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 12;

  // ── Cabecalho ──────────────────────────────────────────────
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageW, 42, 'F');

  // Logo IASD — esquerda
  try { doc.addImage(ADVENTIST_LOGO_BASE64, 'PNG', margin - 2, 5, 30, 30); }
  catch (e) { console.warn('Erro logo:', e); }

  // Imagem: Recepção usa imagem fixa (metade direita do cabeçalho)
  // Outros ministérios usam upload do diretor (pequeno, canto direito)
  if (isRecepcao) {
    try {
      // Ocupa a metade direita do cabeçalho: de x=105 até x=208, altura 38px
      doc.addImage(RECEPCAO_IMAGE_BASE64, 'JPEG', 105, 2, 103, 38);
    } catch (e) { console.warn('Erro imagem recepcao:', e); }
  } else if (ministryImage) {
    try {
      const ext = ministryImage.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(ministryImage, ext, pageW - margin - 32, 4, 32, 32);
    } catch (e) { console.warn('Erro imagem:', e); }
  }

  // Textos do cabeçalho
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
  doc.setFontSize(6.5);
  doc.setTextColor(150, 190, 240);
  doc.text('Gerado em ' + today, isRecepcao ? 100 : pageW - margin, 38, { align: 'right' });

  let startY = 46;

  // ── Observacoes (nao-recepcao) ─────────────────────────────
  if (!isRecepcao && observations && observations.trim()) {
    doc.setFillColor(237, 242, 255);
    doc.setDrawColor(180, 200, 240);
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
  // RECEPCAO: layout 2 colunas por mês, ultra-compacto
  // ══════════════════════════════════════════════════════════
  if (isRecepcao) {
    // Agrupa por mês
    const groups = {};
    for (const d of dates) {
      if (!groups[d.month]) groups[d.month] = { monthName: MONTHS_PT[d.month], dates: [] };
      groups[d.month].dates.push(d);
    }

    // Largura de cada "mini-tabela" (2 colunas por página)
    const colW = (pageW - margin * 2 - 6) / 2; // 6mm de gap entre colunas
    let colIndex = 0; // 0 = esquerda, 1 = direita
    let colY = startY;
    let maxY = startY; // controla qual coluna é mais longa

    for (const [, group] of Object.entries(groups)) {
      const x = colIndex === 0 ? margin : margin + colW + 6;
      let y = colIndex === 0 ? colY : colY;

      // Se ambas colunas usadas, avança para próxima linha
      if (colIndex === 0) {
        y = maxY;
        colY = maxY;
      }

      // Título do mês
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(150, 50, 75);
      doc.text(group.monthName, x + colW / 2, y + 4, { align: 'center' });
      doc.setDrawColor(180, 80, 100);
      doc.setLineWidth(0.35);
      doc.line(x, y + 5.5, x + colW, y + 5.5);
      y += 7;

      // Monta linhas da tabela para este mês
      const head = [['Data', 'Dia', 'Rec. 1', 'Rec. 2']];
      const body = group.dates.map(d => {
        const entry = scheduleData[d.id] || {};
        const isSab = d.dayOfWeek === 6;
        return [
          d.label.split(', ')[1] || d.label,
          DAY_NAME[d.dayOfWeek] || '',
          entry['recepcao_1'] || '—',
          isSab ? (entry['recepcao_2'] || '—') : '',
        ];
      });

      doc.autoTable({
        startY: y,
        head,
        body,
        headStyles: {
          fillColor: [180, 70, 95],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7,
          halign: 'center',
          cellPadding: 1.5,
          lineWidth: 0.2,
        },
        bodyStyles: {
          fontSize: 6.5,
          textColor: [20, 20, 40],
          cellPadding: 1.2,
          lineColor: [210, 190, 200],
          lineWidth: 0.15,
        },
        alternateRowStyles: { fillColor: [255, 240, 245] },
        tableLineColor: [200, 160, 175],
        tableLineWidth: 0.2,
        tableWidth: colW,
        margin: { left: x, right: pageW - x - colW },
        columnStyles: {
          0: { halign: 'center', cellWidth: colW * 0.28, fontStyle: 'bold' },
          1: { halign: 'center', cellWidth: colW * 0.22 },
          2: { cellWidth: colW * 0.25 },
          3: { cellWidth: colW * 0.25 },
        },
        didDrawPage: footer,
      });

      const tableBottom = doc.lastAutoTable.finalY + 4;

      if (colIndex === 0) {
        maxY = tableBottom;
        colIndex = 1;
      } else {
        maxY = Math.max(maxY, tableBottom);
        colIndex = 0;
      }
    }

    return doc.save('Escala_Recepcao_' + periodLabel.replace(/\s/g,'_') + '.pdf');
  }

  // ── Estilos padrão para outros ministérios ─────────────────
  const headStyles = {
    fillColor: [201, 152, 58], textColor: [255, 255, 255],
    fontStyle: 'bold', fontSize: 10, halign: 'center',
    cellPadding: 4, lineColor: [160, 120, 40], lineWidth: 0.3,
  };
  const bodyStyles = {
    fontSize: 9.5, textColor: [20, 30, 50],
    cellPadding: 3.5, lineColor: [200, 210, 230], lineWidth: 0.25,
  };

  // ══════════════════════════════════════════════════════════
  // DIACONATO: semanal
  // ══════════════════════════════════════════════════════════
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

  // ══════════════════════════════════════════════════════════
  // MUSICA e outros com campos por dia
  // ══════════════════════════════════════════════════════════
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
    // Sonoplastia e outros fixos
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
