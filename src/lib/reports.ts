import { ASSOCIATION, dateLabel, money } from './utils';
import { report, getActiveCase } from './api';
import type { PickupPoint, Report, WelfareCase } from './types';

export async function createReportPDF(data: Report, activeCase?: WelfareCase | null) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `ROCS CREW Contribution Report — ${data.point?.code || 'All pickup points'}`, subject: 'Riders Welfare Contribution System', author: ASSOCIATION, creator: 'ROCS CREW Admin' });
  doc.setFillColor(28, 98, 73); doc.rect(0, 0, 210, 4, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(32, 83, 57); doc.text('ROCS CREW', 14, 20);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(105, 122, 106); doc.text('WELFARE ASSOCIATION', 14, 26);
  doc.setFontSize(8); doc.text('RIDERS WELFARE CONTRIBUTION SYSTEM', 196, 20, { align: 'right' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(40, 57, 42); doc.text('Contribution report', 14, 42);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(82, 102, 78); doc.text(data.point ? `${data.point.name} (${data.point.code})` : 'All pickup points', 14, 51);
  doc.setFontSize(9); doc.text(`Period: ${dateLabel(data.from + 'T12:00:00+03:00')} - ${dateLabel(data.to + 'T12:00:00+03:00')}  |  Currency: KES`, 14, 58);
  doc.setDrawColor(221, 230, 216); doc.line(14, 63, 196, 63);

  // ── Active welfare case banner ──────────────────────────────────────────────
  const wCase = activeCase ?? data.activeCase;
  let tableStartY = 69;
  if (wCase) {
    const isHospital = wCase.case_type === 'hospital';
    const bannerColor: [number, number, number] = isHospital ? [219, 234, 254] : [254, 226, 226];
    const bannerBorder: [number, number, number] = isHospital ? [147, 197, 253] : [252, 165, 165];
    const textColor: [number, number, number] = isHospital ? [30, 64, 175] : [153, 27, 27];
    doc.setFillColor(...bannerColor); doc.setDrawColor(...bannerBorder); doc.roundedRect(14, 66, 182, 22, 2, 2, 'FD');
    const label = isHospital ? '🏥 HOSPITAL CASE — CONTRIBUTIONS FOR BENEFICIARY' : '🕊️  BEREAVEMENT CASE — CONTRIBUTIONS FOR BENEFICIARY';
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...textColor);
    doc.text(label, 19, 73);
    const beneficiary = `${wCase.member_name || 'Member'} · QR ${wCase.member_qr || '—'} · ${wCase.pickup_name || ''} (${wCase.pickup_code || ''})`;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...textColor);
    doc.text(beneficiary, 19, 80);
    if (wCase.description) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(80, 80, 100);
      doc.text(`Note: ${wCase.description}`, 19, 86);
      tableStartY = 95;
    } else {
      tableStartY = 92;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  autoTable(doc, {
    startY: tableStartY, margin: { left: 14, right: 14, top: 18, bottom: 24 },
    head: [['QR No', 'Name', 'Phone', 'No. of payments', 'Total paid (KES)']],
    body: data.rows.length ? data.rows.map(r => [r.qr_number, r.full_name, '0' + r.phone.slice(3), String(r.payment_count), Number(r.total).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })]) : [['—', 'No members in this pickup point', '—', '0', '0.00']],
    foot: [['', 'GRAND TOTAL', '', String(data.paymentCount), Number(data.grandTotal).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })]],
    theme: 'plain', styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3, minCellHeight: 9, textColor: [66, 81, 62], lineColor: [231, 237, 226], lineWidth: 0.1 },
    headStyles: { fillColor: [234, 242, 229], textColor: [66, 95, 54], fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: [31, 98, 73], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [249, 251, 247] }, columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 60 }, 2: { cellWidth: 33 }, 3: { cellWidth: 30, halign: 'right' }, 4: { cellWidth: 41, halign: 'right' } },
    didDrawPage: ({ pageNumber }) => { if (pageNumber > 1) { doc.setFontSize(8); doc.setTextColor(111, 130, 101); doc.text(`ROCS CREW · ${data.point?.code || 'All pickup points'}`, 14, 11); } },
  });
  const pages = doc.getNumberOfPages();
  const generated = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short' });
  for (let page = 1; page <= pages; page++) { doc.setPage(page); doc.setDrawColor(223, 231, 217); doc.line(14, 280, 196, 280); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130, 144, 121); doc.text(`Generated on ${generated} EAT`, 14, 286); doc.text(`Page ${page} of ${pages}`, 196, 286, { align: 'right' }); }
  return doc;
}
export function reportFilename(data: Report) { return `ROCS_CREW_${data.point?.code || 'AllPoints'}_${data.from}_${data.to}.pdf`; }
export async function downloadAllReports(points: PickupPoint[], from: string, to: string, progress: (done: number, total: number) => void) {
  if (!points.length) throw new Error('Add a pickup point before downloading reports.');
  const { default: JSZip } = await import('jszip'); const zip = new JSZip(); let done = 0;
  // Fetch active case once for all reports
  const activeCase = await getActiveCase().catch(() => null);
  for (let i = 0; i < points.length; i += 3) {
    await Promise.all(points.slice(i, i + 3).map(async point => { const data = await report(point.id, from, to); const pdf = await createReportPDF(data, activeCase); zip.file(reportFilename(data), pdf.output('blob')); progress(++done, points.length); }));
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
