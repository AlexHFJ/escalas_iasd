import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { ADVENTIST_LOGO_BASE64 } from './adventistLogo';
import { getFieldsForDate } from './ministryConfig';

const DAY_NAME = { 0: 'Domingo', 3: 'Quarta-feira', 6: 'Sábado' };

export async function generateSchedulePDF({
  churchName,
  ministryLabel,
  periodLabel,
  ministry,
  dates,
  scheduleData,
  ministryImage,   // imagem personalizada do ministério (base64)
  observations,    // texto de observações do ministério
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ── Cabeçalho ──────────────────────────────────────────────
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageW, 38, 'F');

  // Logo IASD (sempre presente, lado esquerdo)
  try {
    doc.addImage(ADVENTIST_LOGO_BASE64, 'PNG', 6, 3, 30, 30);
  } catch (e) {
    console.warn('Erro ao adicionar logo IASD:', e);
  }

  // Imagem personalizada do ministério (lado direito do cabeçalho)
  if (ministryImage) {
    try {
      const ext = ministryImage.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(ministryImage, ext, pageW - 36, 3, 30, 30);
    } catch (e) {
      console.warn('Erro ao adicionar imagem do ministério:', e);
    }
  }

  // Textos do cabeçalho
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(churchName || 'Igreja Adventista do Sétimo Dia', 42, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Escala de ${ministryLabel} — ${periodLabel}`, 42, 22);

  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.setFontSize(7.5);
  doc.setTextColor(180, 210, 255);
  doc.text(`Gerado em ${today}`, pageW - (ministryImage ? 40 : 12), 32, { align: 'right' });

  let startY = 42;

  // ── Observações (se houver) ─────────────────────────────────
  if (observations && observations.trim()) {
    doc.setFillColor(240, 244, 255);
    doc.setDrawColor(180, 200, 240);
    doc.roundedRect(10, startY, pageW - 20, 0, 2, 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 95);
    doc.text('Observações:', 12, startY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(50, 50, 80);

    const lines = doc.splitTextToSize(observations, pageW - 26);
    doc.text(lines, 12, startY + 10);
    startY += 10 + lines.length * 4 + 4;
  }

  // ── Para música: agrupa por tipo de dia ────────────────────
  if (ministry?.fieldsByDay) {
    const dayGroups = {
      6: { label: 'Sábados',        dates: dates.filter(d => d.dayOfWeek === 6) },
      0: { label: 'Domingos',       dates: dates.filter(d => d.dayOfWeek === 0) },
      3: { label: 'Quartas-feiras', dates: dates.filter(d => d.dayOfWeek === 3) },
    };

    for (const [dow, group] of Object.entries(dayGroups)) {
      if (group.dates.length === 0) continue;
      const fields = ministry.fieldsByDay[parseInt(dow)] || [];
      if (fields.length === 0) continue;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 58, 95);
      doc.text(group.label, 10, startY + 4);
      startY += 2;

      const head = [['Data', ...fields.map(f => f.label)]];
      const body = group.dates.map(d => {
        const entry = scheduleData[d.id] || {};
        return [
          d.label,
          ...fields.map(f => entry[f.id] || '—'),
        ];
      });

      doc.autoTable({
        startY,
        head,
        body,
        headStyles: { fillColor: [201, 152, 58], textColor: [255,255,255], fontStyle: 'bold', fontSize: 8.5, halign: 'center' },
        bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
        alternateRowStyles: { fillColor: [240, 244, 255] },
        columnStyles: { 0: { halign: 'center', cellWidth: 40 } },
        margin: { left: 10, right: 10 },
        didDrawPage: drawFooter(doc, churchName, ministryLabel, pageW, pageH),
      });

      startY = doc.lastAutoTable.finalY + 6;
    }
  } else {
    // ── Outros ministérios: tabela única ───────────────────────
    const fields = ministry?.fields || [];
    const head = [['Data', 'Dia', ...fields.map(f => f.label)]];
    const body = dates.map(d => {
      const entry = scheduleData[d.id] || {};
      return [d.label.split(', ')[1] || d.label, DAY_NAME[d.dayOfWeek] || '', ...fields.map(f => entry[f.id] || '—')];
    });

    doc.autoTable({
      startY,
      head,
      body,
      headStyles: { fillColor: [201, 152, 58], textColor: [255,255,255], fontStyle: 'bold', fontSize: 9, halign: 'center' },
      bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
      alternateRowStyles: { fillColor: [240, 244, 255] },
      columnStyles: { 0: { halign: 'center', cellWidth: 22 }, 1: { halign: 'center', cellWidth: 28 } },
      margin: { left: 10, right: 10 },
      didDrawPage: drawFooter(doc, churchName, ministryLabel, pageW, pageH),
    });
  }

  const filename = `Escala_${ministryLabel.replace(/\s/g, '_')}_${periodLabel.replace(/\s/g, '_')}.pdf`;
  doc.save(filename);
}

function drawFooter(doc, churchName, ministryLabel, pageW, pageH) {
  return (data) => {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`${churchName} — Escala de ${ministryLabel}`, pageW / 2, pageH - 6, { align: 'center' });
    doc.text(`Pág. ${data.pageNumber}`, pageW - 10, pageH - 6, { align: 'right' });
  };
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
