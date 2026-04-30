import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { ADVENTIST_LOGO_BASE64 } from './adventistLogo';
import { RECEPCAO_IMAGE_BASE64 } from './recepcaoImage';

const DAY_NAME = { 0: 'Domingo', 3: 'Quarta-feira', 6: 'Sabado' };

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
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  // ── Cabecalho ──────────────────────────────────────────────
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageW, 42, 'F');

  try { doc.addImage(ADVENTIST_LOGO_BASE64, 'PNG', margin - 2, 5, 30, 30); }
  catch (e) { console.warn('Erro logo:', e); }

  // Imagem do ministério: Recepção usa a imagem fixa, outros usam upload do diretor
  const imgToUse = isRecepcao ? RECEPCAO_IMAGE_BASE64 : ministryImage;
  if (imgToUse) {
    try {
      const ext = imgToUse.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(imgToUse, ext, pageW - margin - 36, 3, 36, 34);
    } catch (e) { console.warn('Erro imagem:', e); }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(churchName || 'Igreja Adventista do Setimo Dia', 46, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Escala de ' + ministryLabel, 46, 24);
  doc.setFontSize(9);
  doc.setTextColor(180, 210, 255);
  doc.text(periodLabel, 46, 31);
  const today = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
  doc.setFontSize(7);
  doc.setTextColor(150, 190, 240);
  doc.text('Gerado em ' + today, pageW - margin, 38, { align: 'right' });

  let startY = 47;

  // ── Observacoes ─────────────────────────────────────────────
  if (!isRecepcao && observations && observations.trim()) {
    doc.setFillColor(237, 242, 255);
    doc.setDrawColor(180, 200, 240);
    const obsLines = doc.splitTextToSize(observations, pageW - margin * 2 - 8);
    const obsH = obsLines.length * 5 + 12;
    doc.roundedRect(margin, startY, pageW - margin * 2, obsH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 58, 95);
    doc.text('Observacoes:', margin + 4, startY + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(40, 60, 100);
    doc.text(obsLines, margin + 4, startY + 12);
    startY += obsH + 5;
  }

  // ── Estilos ────────────────────────────────────────────────
  const headStyles = {
    fillColor: [201, 152, 58], textColor: [255, 255, 255],
    fontStyle: 'bold', fontSize: 10, halign: 'center',
    cellPadding: 4, lineColor: [160, 120, 40], lineWidth: 0.3,
  };
  const bodyStyles = {
    fontSize: 9.5, textColor: [20, 30, 50],
    cellPadding: 3.5, lineColor: [200, 210, 230], lineWidth: 0.25,
  };

  // Estilos compactos para Recepção (cabe em 1 página)
  const headStylesCompact = {
    fillColor: [190, 80, 100], textColor: [255, 255, 255],
    fontStyle: 'bold', fontSize: 8.5, halign: 'center',
    cellPadding: 2.5, lineColor: [150, 60, 80], lineWidth: 0.3,
  };
  const bodyStylesCompact = {
    fontSize: 8, textColor: [20, 30, 50],
    cellPadding: 2, lineColor: [210, 200, 210], lineWidth: 0.2,
  };

  function footer(data) {
    doc.setFontSize(7); doc.setTextColor(150, 150, 160);
    doc.text('Desenvolvido por Alex Fujimori', margin, pageH - 6);
    doc.text(churchName + ' — Escala de ' + ministryLabel + ' — ' + periodLabel,
      pageW / 2, pageH - 6, { align: 'center' });
    doc.text('Pagina ' + data.pageNumber, pageW - margin, pageH - 6, { align: 'right' });
  }

  // ══════════════════════════════════════════════════════════
  // RECEPCAO: agrupado por mês, compacto, 1 página
  // ══════════════════════════════════════════════════════════
  if (isRecepcao) {
    // Agrupa datas por mês
    const groups = {};
    for (const d of dates) {
      if (!groups[d.month]) groups[d.month] = { monthName: MONTHS_PT[d.month], dates: [] };
      groups[d.month].dates.push(d);
    }

    const fields = ministry?.fieldsByDay
      ? ministry.fields
      : ministry?.fields || [];

    let firstGroup = true;

    for (const [, group] of Object.entries(groups)) {
      // Título do mês
      if (!firstGroup) startY += 3;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(190, 80, 100);
      doc.text(group.monthName, pageW / 2, startY + 4, { align: 'center' });

      // Linha decorativa abaixo do título
      doc.setDrawColor(190, 80, 100);
      doc.setLineWidth(0.4);
      doc.line(margin, startY + 6, pageW - margin, startY + 6);
      startY += 5;

      const head = [['Data', 'Dia', ...fields.map(f => f.label)]];
      const body = group.dates.map(d => {
        const entry = scheduleData[d.id] || {};
        const dayFieldIds = new Set(
          (ministry?.fieldsByDay ? (ministry.fieldsByDay[d.dayOfWeek] || []) : fields).map(f => f.id)
        );
        return [
          d.label.split(', ')[1] || d.label,
          DAY_NAME[d.dayOfWeek] || '',
          ...fields.map(f => dayFieldIds.has(f.id) ? (entry[f.id] || '—') : ''),
        ];
      });

      doc.autoTable({
        startY,
        head,
        body,
        headStyles: headStylesCompact,
        bodyStyles: bodyStylesCompact,
        alternateRowStyles: { fillColor: [255, 240, 245] },
        tableLineColor: [210, 180, 190],
        tableLineWidth: 0.2,
        columnStyles: {
          0: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
          1: { halign: 'center', cellWidth: 28 },
        },
        margin: { left: margin, right: margin },
        didDrawPage: footer,
      });

      startY = doc.lastAutoTable.finalY + 4;
      firstGroup = false;
    }

    return doc.save('Escala_Recepcao_' + periodLabel.replace(/\s/g,'_') + '.pdf');
  }

  // ══════════════════════════════════════════════════════════
  // DIACONATO: semanal
  // ══════════════════════════════════════════════════════════
  if (ministry?.isWeekly) {
    const fields = ministry.fields || [];
    const head = [['Periodo (Dom ao Sab)', ...fields.map(f => f.label)]];
    const body = dates.map(w => {
      const entry = scheduleData[w.id] || {};
      return [w.label, ...fields.map(f => entry[f.id] || '—')];
    });
    doc.autoTable({
      startY, head, body, headStyles, bodyStyles,
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
    const head = [['Data', 'Dia', ...allFields.map(f => f.label)]];
    const body = dates.map(d => {
      const entry = scheduleData[d.id] || {};
      const dayFieldIds = new Set((ministry.fieldsByDay[d.dayOfWeek] || []).map(f => f.id));
      return [
        d.label.split(', ')[1] || d.label,
        DAY_NAME[d.dayOfWeek] || '',
        ...allFields.map(f => dayFieldIds.has(f.id) ? (entry[f.id] || '—') : ''),
      ];
    });
    doc.autoTable({
      startY, head, body, headStyles, bodyStyles,
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
    // ── Sonoplastia e outros fixos ─────────────────────────
    const fields = ministry?.fields || [];
    const head = [['Data', 'Dia', ...fields.map(f => f.label)]];
    const body = dates.map(d => {
      const entry = scheduleData[d.id] || {};
      return [
        d.label.split(', ')[1] || d.label,
        DAY_NAME[d.dayOfWeek] || '',
        ...fields.map(f => entry[f.id] || '—'),
      ];
    });
    doc.autoTable({
      startY, head, body, headStyles, bodyStyles,
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

  const filename = 'Escala_' + ministryLabel.replace(/\s/g,'_') + '_' + periodLabel.replace(/\s/g,'_') + '.pdf';
  doc.save(filename);
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
