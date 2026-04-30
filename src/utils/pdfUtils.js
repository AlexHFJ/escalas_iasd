import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { ADVENTIST_LOGO_BASE64 } from './adventistLogo';

const DAY_NAME = { 0: 'Domingo', 3: 'Quarta-feira', 6: 'Sabado' };

export async function generateSchedulePDF({
  churchName, ministryLabel, periodLabel,
  ministry, dates, scheduleData,
  ministryImage, observations,
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  // ── Cabecalho ──────────────────────────────────────────────
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageW, 42, 'F');

  try { doc.addImage(ADVENTIST_LOGO_BASE64, 'PNG', margin - 2, 5, 30, 30); }
  catch (e) { console.warn('Erro logo:', e); }

  if (ministryImage) {
    try {
      const ext = ministryImage.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(ministryImage, ext, pageW - margin - 28, 5, 28, 28);
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
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.setFontSize(7);
  doc.setTextColor(150, 190, 240);
  doc.text('Gerado em ' + today, pageW - margin, 38, { align: 'right' });

  let startY = 47;

  // ── Observacoes ─────────────────────────────────────────────
  if (observations && observations.trim()) {
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
  function footer(data) {
    doc.setFontSize(7.5); doc.setTextColor(150, 150, 160);
    doc.text('Desenvolvido por Alex Fujimori', margin, pageH - 8);
    doc.text(churchName + ' — Escala de ' + ministryLabel + ' — ' + periodLabel,
      pageW / 2, pageH - 8, { align: 'center' });
    doc.text('Pagina ' + data.pageNumber, pageW - margin, pageH - 8, { align: 'right' });
  }

  // ── Diaconato: tabela semanal ──────────────────────────────
  if (ministry?.isWeekly) {
    const fields = ministry.fields || [];
    const head = [['Periodo (Dom ao Sab)', ...fields.map(f => f.label)]];
    const body = dates.map(w => {
      const entry = scheduleData[w.id] || {};
      return [w.label, ...fields.map(f => entry[f.id] || '—')];
    });
    doc.autoTable({
      startY, head, body, headStyles, bodyStyles,
      alternateRowStyles: { fillColor: [255, 248, 230] }, // tom âmbar claro
      tableLineColor: [200, 180, 130], tableLineWidth: 0.3,
      columnStyles: { 0: { halign: 'center', cellWidth: 50, fontStyle: 'bold' } },
      margin: { left: margin, right: margin },
      didDrawPage: footer,
    });
    return doc.save('Escala_Diaconato_' + periodLabel.replace(/\s/g,'_') + '.pdf');
  }

  // ── Musica e Recepcao: tabela com campos por dia ───────────
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
    // ── Outros ministerios ─────────────────────────────────────
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
