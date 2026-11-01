'use client';
import { useRef, useState } from 'react';
import Papa from 'papaparse';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, FileUp, UploadCloud } from 'lucide-react';
import { existingMembers, mutate } from '@/lib/api';
import { validateImport } from '@/lib/validation';
import { errorMessage } from '@/lib/utils';
import type { ImportRow, PickupPoint } from '@/lib/types';
import { EmptyState, InlineError, Modal, Pagination, Spinner } from './ui';
import { downloadBlob } from '@/lib/download';
type PreviewRow = ImportRow & { line: number; errors: string[] };
export function ImportMembers({ points, onClose, onImported }: { points: PickupPoint[]; onClose: () => void; onImported: (count: number) => void }) {
  const input = useRef<HTMLInputElement>(null); const [rows, setRows] = useState<PreviewRow[]>([]), [filename, setFilename] = useState(''), [error, setError] = useState(''), [parsing, setParsing] = useState(false), [saving, setSaving] = useState(false), [dragging, setDragging] = useState(false), [page, setPage] = useState(1);
  const errors = rows.filter(r => r.errors.length).length;
  const parse = async (file: File) => {
    setError(''); setRows([]); setPage(1); setFilename(file.name);
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('Choose a .csv file. Export your spreadsheet as CSV and try again.'); return; }
    if (file.size > 2 * 1024 * 1024) { setError('This file is too large. Use a CSV smaller than 2 MB.'); return; }
    setParsing(true);
    let existing: Set<string>;
    try { existing = new Set((await existingMembers()).map(m => `${m.pickup_point_id}:${m.qr_number}`)); }
    catch (e) { setError(errorMessage(e)); setParsing(false); return; }
    Papa.parse<Record<string, string>>(file, { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim().toLowerCase().replace(/^\uFEFF/, ''), complete: result => {
      setParsing(false);
      const required = ['full_name', 'phone', 'qr_number', 'pickup_code'];
      const missing = required.filter(h => !result.meta.fields?.includes(h));
      if (missing.length) { setError(`Missing columns: ${missing.join(', ')}. Download the sample for the correct format.`); return; }
      if (new Set(result.meta.fields).size !== result.meta.fields?.length) { setError('The CSV contains duplicate column headers. Use each required column once.'); return; }
      if (result.errors.length) { setError(`Check CSV row ${(result.errors[0].row ?? 0) + 2}: ${result.errors[0].message}. No records have been imported.`); return; }
      if (!result.data.length) { setError('This CSV has no member records. Add rows below the header and try again.'); return; }
      if (result.data.length > 5000) { setError('Import up to 5,000 members at once. Split this file into smaller batches.'); return; }
      // Preflight includes existing QR numbers. The server rechecks inside an atomic import.
      const preview = result.data.map((r, i) => { const row = { full_name: String(r.full_name ?? ''), phone: String(r.phone ?? ''), qr_number: String(r.qr_number ?? ''), pickup_code: String(r.pickup_code ?? '') }; const validation = validateImport(row, points, existing); return { ...row, line: i + 2, errors: validation.errors }; });
      setRows(preview);
    }, error: e => { setParsing(false); setError(e.message); } });
  };
  const importRows = async () => { if (!rows.length || errors || saving) return; setSaving(true); setError(''); try { const result = await mutate('import-members', { rows: rows.map(({ full_name, phone, qr_number, pickup_code }) => ({ full_name, phone, qr_number, pickup_code })) }); onImported(result.imported); } catch (e) { setError(errorMessage(e)); } finally { setSaving(false); } };
  const sample = () => downloadBlob(new Blob(['full_name,phone,qr_number,pickup_code\nJane Wanjiku,0712345678,025,KM001\nPaul Otieno,0112345678,026,KM001\n'], { type: 'text/csv;charset=utf-8' }), 'stanriders-members-template.csv');
  return <Modal title="Import your member register" subtitle="Upload a CSV, review every record, then bring your riders on board." onClose={onClose} wide><div className="space-y-5 p-6"><div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e4eae1] bg-[#f7faf5] p-3"><div className="flex items-center gap-2 text-[11px] text-[#839577]"><FileSpreadsheet size={17} /><span>Required: <strong className="font-medium">full_name, phone, qr_number, pickup_code</strong></span></div><button className="flex items-center gap-1.5 text-[10px] font-semibold text-brand" onClick={sample}><Download size={13} />Download sample</button></div><InlineError message={error} />
    {!rows.length ? <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file && !saving) parse(file); }} className={`rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${dragging ? 'border-brand bg-[#edf6eb]' : 'border-[#dce5d7] bg-[#fcfdfb]'}`}><UploadCloud size={34} strokeWidth={1.3} className="mx-auto mb-4 text-[#90a67f]" /><h3 className="text-sm font-bold text-[#5b7450]">Drop your member register here</h3><p className="mt-2 text-[11px] text-[#9aa68f]">CSV files up to 2 MB · 5,000 members per import</p><button className="btn btn-secondary mt-5" onClick={() => input.current?.click()} disabled={parsing}>{parsing ? <Spinner label="Reading CSV…" /> : <><FileUp size={14} />Choose CSV file</>}</button></div> : <><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs font-semibold"><FileSpreadsheet size={17} className="text-brand" />{filename}</div><button className="text-[10px] font-semibold text-brand" disabled={saving} onClick={() => { setRows([]); setFilename(''); setError(''); if (input.current) input.current.value = ''; }}>Choose a different file</button></div><div className="flex flex-wrap gap-3 rounded-lg bg-[#f6f9f3] p-3 text-[11px]"><span className="text-[#8b9980]">{rows.length} records</span><span className="flex items-center gap-1 text-[#5f925d]"><CheckCircle2 size={13} />{rows.length - errors} valid</span><span className={`flex items-center gap-1 ${errors ? 'text-[#b37c49]' : 'text-[#9da793]'}`}><AlertCircle size={13} />{errors} with errors</span></div>{errors > 0 && <p className="text-[11px] leading-relaxed text-[#b18b5d]">Fix the highlighted issues in your CSV and upload it again. Nothing is imported until every row passes validation.</p>}<div className="table-wrap max-h-[340px] overflow-y-auto rounded-lg border border-[#e6ebe1]"><table className="data-table"><thead><tr><th>Row</th><th>Name</th><th>Phone</th><th>QR no.</th><th>Pickup</th><th>Validation</th></tr></thead><tbody>{rows.slice((page - 1) * 10, page * 10).map(row => <tr key={row.line} className={row.errors.length ? '!bg-[#fffaf3]' : ''}><td>{row.line}</td><td>{row.full_name || '—'}</td><td>{row.phone || '—'}</td><td className="font-mono">{row.qr_number || '—'}</td><td>{row.pickup_code || '—'}</td><td>{row.errors.length ? <span className="flex items-center gap-1.5 text-[10px] text-[#b18353]"><AlertCircle size={12} />{row.errors.join('; ')}</span> : <span className="flex items-center gap-1 text-[10px] text-[#649360]"><CheckCircle2 size={12} />Ready to import</span>}</td></tr>)}</tbody></table></div><Pagination page={page} pageSize={10} total={rows.length} onChange={setPage} /></>}
    <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Choose member CSV file" onChange={e => { const file = e.target.files?.[0]; if (file) parse(file); }} /><p className="text-[10px] leading-relaxed text-[#9ca791]">Phone numbers accept 07xx, 01xx and +254 formats. QR numbers must be unique within each pickup point. In Excel, format phone and QR columns as text to preserve leading zeros.</p></div><div className="flex justify-end gap-2 border-t border-[#edf0ee] p-5"><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!rows.length || errors > 0 || saving || parsing} onClick={importRows}>{saving ? <Spinner label="Checking & importing…" /> : <><FileUp size={14} />Import {rows.length || ''} members</>}</button></div></Modal>;
}
