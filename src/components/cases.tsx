'use client';
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, Heart, Hospital, Plus, Search, UserRound, X } from 'lucide-react';
import { closeCase, list, listCases, openCase } from '@/lib/api';
import { dateLabel, errorMessage, timeLabel } from '@/lib/utils';
import type { Member, WelfareCase } from '@/lib/types';
import { EmptyState, ErrorState, Field, InlineError, LoadingState, Modal, Pagination, Spinner, useQuery } from './ui';

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  hospital: { label: 'In Hospital', icon: <Hospital size={14} />, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  death: { label: 'Bereavement', icon: <Heart size={14} />, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
};

function MemberSearch({ onSelect }: { onSelect: (m: Member) => void }) {
  const [search, setSearch] = useState('');
  const { data, loading } = useQuery(() => search.trim().length >= 2 ? list<Member>('member-options', { search, pageSize: 8 }) : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 8 }), `member-search-${search}`);
  return (
    <div className="space-y-2">
      <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a0ac90]" /><input className="input !pl-8" placeholder="Search by name, phone or QR…" value={search} onChange={e => setSearch(e.target.value)} autoFocus /></div>
      {loading && <div className="py-2 text-center text-[10px] text-[#9caa8c]"><Spinner label="Searching…" /></div>}
      {!loading && data && data.items.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-[#e0e8d8] bg-white shadow-sm">
          {data.items.map(m => (
            <button key={m.id} onClick={() => onSelect(m)} className="flex w-full items-center gap-3 border-b border-[#f0f4ec] px-3 py-2.5 text-left last:border-0 hover:bg-[#f4f8ef]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#edf4e6] text-[9px] font-bold text-[#6a8858]"><UserRound size={13} /></span>
              <div><p className="text-[11px] font-semibold text-[#4a5e3e]">{m.full_name}</p><p className="text-[9px] text-[#91a080]">QR {m.qr_number} · {'0' + m.phone.slice(3)} · {m.pickup_points?.code}</p></div>
            </button>
          ))}
        </div>
      )}
      {!loading && search.trim().length >= 2 && data?.items.length === 0 && <p className="py-2 text-center text-[10px] text-[#9caa8c]">No active members found.</p>}
      {search.trim().length < 2 && <p className="text-[9px] text-[#aab49c]">Type at least 2 characters to search members.</p>}
    </div>
  );
}

function OpenCaseModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<'search' | 'form'>('search');
  const [member, setMember] = useState<Member | null>(null);
  const [caseType, setCaseType] = useState<'hospital' | 'death'>('hospital');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!member) return;
    setSaving(true); setError('');
    try {
      await openCase(member.id, caseType, description);
      onSuccess();
      onClose();
    } catch (e) { setError(errorMessage(e)); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Open a welfare case" subtitle="One case at a time — the active case will appear on all contribution reports." onClose={onClose}>
      <div className="space-y-5 p-6">
        <InlineError message={error} />
        {step === 'search' ? (
          <>
            <p className="text-[11px] text-[#7a8d72]">Search for the affected member (beneficiary):</p>
            <MemberSearch onSelect={m => { setMember(m); setStep('form'); }} />
          </>
        ) : (
          <>
            {/* Selected member */}
            <div className="flex items-center gap-3 rounded-xl border border-[#d1e8c8] bg-[#edf6e6] px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d4eccc] text-[10px] font-bold text-[#4c7a3e]"><UserRound size={16} /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#3c6132]">{member!.full_name}</p><p className="text-[9px] text-[#6a9260]">QR {member!.qr_number} · {'0' + member!.phone.slice(3)} · {member!.pickup_points?.name}</p></div>
              <button onClick={() => { setMember(null); setStep('search'); }} className="ml-auto rounded p-1 text-[#7a9a72] hover:bg-[#dff0d8]"><X size={14} /></button>
            </div>

            <Field label="Case type">
              <div className="grid grid-cols-2 gap-3">
                {(['hospital', 'death'] as const).map(t => {
                  const { label, icon, color, bg, border } = TYPE_LABELS[t];
                  return (
                    <button key={t} type="button" onClick={() => setCaseType(t)} className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-[11px] font-semibold transition-all ${caseType === t ? `${bg} ${border} ${color}` : 'border-[#e5ede0] bg-white text-[#8a9b82] hover:border-[#c1d4b4]'}`}>
                      {icon}{label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Description / notes (optional)">
              <textarea className="input min-h-[72px] resize-none" placeholder="e.g. Accident on Thika Road, admitted at Kenyatta Hospital…" value={description} onChange={e => setDescription(e.target.value)} maxLength={500} />
              <p className="mt-1 text-[9px] text-[#a7b49d]">{description.length}/500</p>
            </Field>

            <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[10px] ${caseType === 'hospital' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{caseType === 'hospital' ? 'This will mark the association\'s current fundraiser as a hospital case for this member.' : 'This will mark the association\'s current collection as a bereavement contribution for this member.'} The case will appear on all contribution PDF reports until closed.</span>
            </div>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-[#edf0ee] p-5">
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        {step === 'form' && (
          <button className="btn btn-primary" onClick={submit} disabled={saving || !member}>
            {saving ? <Spinner label="Opening case…" /> : <><Plus size={14} />Open case</>}
          </button>
        )}
      </div>
    </Modal>
  );
}

function CloseCaseModal({ wCase, onClose, onSuccess }: { wCase: WelfareCase; onClose: () => void; onSuccess: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const cfg = TYPE_LABELS[wCase.case_type];
  const submit = async () => {
    setSaving(true); setError('');
    try { await closeCase(wCase.id); onSuccess(); onClose(); }
    catch (e) { setError(errorMessage(e)); }
    finally { setSaving(false); }
  };
  return (
    <Modal title="Close this welfare case" subtitle="This will remove the beneficiary from future contribution reports." onClose={onClose}>
      <div className="space-y-5 p-6">
        <InlineError message={error} />
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${cfg.bg} ${cfg.border}`}>
          <span className={cfg.color}>{cfg.icon}</span>
          <div><p className={`text-[11px] font-bold ${cfg.color}`}>{cfg.label}</p><p className="mt-0.5 text-[11px] text-[#5a6852]"><span className="font-semibold">{wCase.member_name}</span> · QR {wCase.member_qr} · {wCase.pickup_name}</p>{wCase.description && <p className="mt-1 text-[9px] text-[#7a8870]">{wCase.description}</p>}</div>
        </div>
        <p className="text-[11px] leading-relaxed text-[#7a8d72]">Closing this case means the beneficiary tag will no longer appear on new contribution PDFs. Historical records remain unchanged. You can open a new case at any time.</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-[#edf0ee] p-5">
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-danger" onClick={submit} disabled={saving}>{saving ? <Spinner label="Closing…" /> : <><CheckCircle2 size={14} />Close case</>}</button>
      </div>
    </Modal>
  );
}

function CaseCard({ wCase, onClose }: { wCase: WelfareCase; onClose: () => void }) {
  const cfg = TYPE_LABELS[wCase.case_type];
  const isOpen = wCase.status === 'open';
  return (
    <div className={`card overflow-hidden transition-shadow hover:shadow-md ${isOpen ? 'ring-2 ring-[#3a885a]/20' : ''}`}>
      <div className={`flex items-center justify-between gap-2 border-b px-4 py-3 ${isOpen ? `${cfg.bg} ${cfg.border}` : 'border-[#e8ede4] bg-[#f6f8f4]'}`}>
        <div className="flex items-center gap-2">
          <span className={isOpen ? cfg.color : 'text-[#9caa8c]'}>{cfg.icon}</span>
          <span className={`text-[10px] font-bold uppercase tracking-wide ${isOpen ? cfg.color : 'text-[#9caa8c]'}`}>{cfg.label}</span>
          {isOpen && <span className="flex items-center gap-1 rounded-full bg-[#3a885a]/10 px-2 py-0.5 text-[8px] font-bold text-[#3a885a]"><span className="h-1.5 w-1.5 rounded-full bg-[#3a885a] animate-pulse" />OPEN</span>}
        </div>
        {isOpen && <button onClick={onClose} className="btn btn-secondary !min-h-7 !px-2.5 !py-1 !text-[9px]">Close case</button>}
      </div>
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#edf4e6] text-[10px] font-bold text-[#6a8858]"><UserRound size={16} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#3c5234]">{wCase.member_name}</p>
            <p className="text-[9px] text-[#91a080]">QR {wCase.member_qr} · {'0' + (wCase.member_phone || '').slice(3)} · {wCase.pickup_name} ({wCase.pickup_code})</p>
            {wCase.description && <p className="mt-1.5 text-[10px] italic text-[#7a8d6c]">{wCase.description}</p>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#edf0ea] pt-3 text-[9px] text-[#9caa8c]">
          <span className="flex items-center gap-1"><Clock size={11} />Opened {dateLabel(wCase.opened_at)} at {timeLabel(wCase.opened_at)}</span>
          {wCase.closed_at && <span className="flex items-center gap-1"><CheckCircle2 size={11} />Closed {dateLabel(wCase.closed_at)}</span>}
        </div>
      </div>
    </div>
  );
}

export function Cases({ notify }: { notify: (message: string, error?: boolean) => void }) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [page, setPage] = useState(1);
  const [openModal, setOpenModal] = useState(false);
  const [closeTarget, setCloseTarget] = useState<WelfareCase | null>(null);

  const { data, loading, error: queryError, refresh } = useQuery<import('@/lib/types').Page<WelfareCase>>(
    () => {
      const f: import('@/lib/types').Filters = { page, pageSize: 10 };
      if (statusFilter !== 'all') f.status = statusFilter;
      return listCases(f);
    },
    `cases-${statusFilter}-${page}`
  );


  const activeCase = data?.items.find(c => c.status === 'open') || null;

  const handleClosed = () => { notify('Welfare case closed. It will no longer appear on future reports.'); refresh(); };
  const handleOpened = () => { notify('Welfare case opened. It will now appear on all contribution PDFs.'); refresh(); };

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-1px]">Welfare Cases</h1>
          <p className="mt-1.5 text-xs text-[#929c95]">Track hospital admissions and bereavements. One active case at a time.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpenModal(true)} disabled={Boolean(activeCase)}>
          <Plus size={15} />Open new case
        </button>
      </div>

      {/* Active case alert */}
      {activeCase && (
        <div className={`flex items-start gap-3 rounded-xl border px-5 py-4 shadow-sm ${activeCase.case_type === 'hospital' ? 'border-blue-200 bg-blue-50' : 'border-red-200 bg-red-50'}`}>
          <span className={activeCase.case_type === 'hospital' ? 'text-blue-600' : 'text-red-600'}>{TYPE_LABELS[activeCase.case_type].icon}</span>
          <div className="flex-1">
            <p className={`text-xs font-bold ${activeCase.case_type === 'hospital' ? 'text-blue-800' : 'text-red-800'}`}>
              Active {activeCase.case_type === 'hospital' ? 'Hospital' : 'Bereavement'} Case
            </p>
            <p className="mt-0.5 text-[11px] text-[#5a6852]">
              <span className="font-semibold">{activeCase.member_name}</span> · QR {activeCase.member_qr} · {activeCase.pickup_name}
              {activeCase.description && ` — ${activeCase.description}`}
            </p>
            <p className="mt-1 text-[9px] text-[#8a9a80]">This beneficiary appears on all contribution PDF reports. Close this case before opening a new one.</p>
          </div>
        </div>
      )}

      {!activeCase && !loading && (
        <div className="flex items-start gap-3 rounded-xl border border-[#e1e9d9] bg-[#f4f8ee] px-5 py-4">
          <ClipboardList size={18} className="mt-0.5 shrink-0 text-[#8ba475]" />
          <div>
            <p className="text-xs font-bold text-[#4f6b43]">No active welfare case</p>
            <p className="mt-0.5 text-[10px] text-[#8ba475]">Open a case when a member is hospitalised or has passed away. Contributions collected during that period will be documented as being for that beneficiary on all PDF reports.</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-[#e8eee1] pb-0">
        {(['all', 'open', 'closed'] as const).map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[11px] font-semibold capitalize transition-colors ${statusFilter === s ? 'border-[#3a885a] text-[#3a885a]' : 'border-transparent text-[#8d9c88] hover:text-[#5a7a52]'}`}>
            {s === 'all' ? 'All cases' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {queryError ? (
        <ErrorState message={queryError} retry={refresh} />
      ) : loading && !data ? (
        <LoadingState rows={4} />
      ) : !data?.items.length ? (
        <EmptyState title="No cases found" description={statusFilter === 'open' ? 'There is no currently active welfare case.' : 'No welfare cases have been recorded yet.'} />
      ) : (
        <div className="space-y-3">
          {data.items.map(wCase => (
            <CaseCard key={wCase.id} wCase={wCase} onClose={() => setCloseTarget(wCase)} />
          ))}
          <Pagination page={page} pageSize={10} total={data.total} onChange={setPage} />
        </div>
      )}

      {openModal && <OpenCaseModal onClose={() => setOpenModal(false)} onSuccess={handleOpened} />}
      {closeTarget && <CloseCaseModal wCase={closeTarget} onClose={() => setCloseTarget(null)} onSuccess={handleClosed} />}
    </div>
  );
}
