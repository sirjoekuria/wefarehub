'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Copy, FileUp, Lock, Pencil, Plus, ShieldCheck } from 'lucide-react';
import { displayPhone, list, mutate } from '@/lib/api';
import type { Member, PickupPoint } from '@/lib/types';
import { errorMessage } from '@/lib/utils';
import { validateMember } from '@/lib/validation';
import { Avatar, EmptyState, ErrorState, Field, InlineError, LoadingState, Modal, Pagination, SearchInput, Spinner, StatusBadge, Toggle, useDebounced, useQuery } from './ui';
import { ImportMembers } from './import-members';

/** Confirmation modal shown when a new ID number is entered for the first time */
function IdConfirmModal({ idNumber, onConfirm, onCancel }: { idNumber: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3 px-7 pt-8 pb-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
            <AlertTriangle size={28} className="text-amber-600 dark:text-amber-400" />
          </span>
          <h2 className="text-[17px] font-extrabold tracking-tight text-slate-900 dark:text-white">
            Confirm National ID Number
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            You are about to save National ID{' '}
            <strong className="font-mono font-bold text-slate-900 dark:text-white">{idNumber}</strong>{' '}
            for this member.
          </p>
          <div className="mt-1 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-left dark:border-amber-800 dark:bg-amber-950/50">
            <Lock size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-[11.5px] leading-relaxed text-amber-800 dark:text-amber-300">
              <strong>This ID cannot be changed later.</strong> Once saved, the National ID is permanently locked to prevent fraud. Please verify carefully before confirming.
            </p>
          </div>
        </div>
        <div className="flex gap-3 border-t border-slate-100 px-7 py-5 dark:border-slate-800">
          <button type="button" className="btn btn-secondary flex-1" onClick={onCancel}>
            Go Back &amp; Edit
          </button>
          <button type="button" className="btn btn-primary flex-1" onClick={onConfirm}>
            <CheckCircle2 size={15} />
            Confirm &amp; Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function Members({ points, initialPoint = '', refreshPoints, notify }: { points: PickupPoint[]; initialPoint?: string; refreshPoints: () => void; notify: (message: string, error?: boolean) => void }) {
  const [search, setSearch] = useState(''), [point, setPoint] = useState(initialPoint), [active, setActive] = useState('all'), [page, setPage] = useState(1), [editing, setEditing] = useState<Member | 'new' | null>(null), [importing, setImporting] = useState(false), [memberActive, setMemberActive] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [pendingValues, setPendingValues] = useState<Record<string, unknown> | null>(null);
  const [showIdConfirm, setShowIdConfirm] = useState(false);
  const term = useDebounced(search);
  useEffect(() => { setPoint(initialPoint); setPage(1); }, [initialPoint]);
  const { data, error: queryError, loading, refresh } = useQuery(() => list<Member>('members', { search: term, point, active, page, pageSize: 10 }), `members-${term}-${point}-${active}-${page}`);
  const open = (member: Member | 'new') => { setError(''); setMemberActive(member === 'new' ? true : member.is_active); setEditing(member); };

  const doSave = async (values: Record<string, unknown>) => {
    if (!editing) return;
    setSaving(true); setError('');
    try {
      validateMember(values);
      await mutate(editing === 'new' ? 'create-member' : 'update-member', { id: editing === 'new' ? undefined : (editing as Member).id, values });
      notify(editing === 'new' ? `${values.full_name} has been added.` : 'Member details updated.');
      setEditing(null); refresh(); refreshPoints();
    } catch (e) { setError(errorMessage(e)); }
    finally { setSaving(false); }
  };

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const form = new FormData(e.currentTarget);
    const values: Record<string, unknown> = {
      full_name: String(form.get('full_name')),
      phone: String(form.get('phone')),
      qr_number: String(form.get('qr_number')),
      pickup_point_id: String(form.get('pickup_point_id')),
      id_number: String(form.get('id_number') || '').trim() || null,
      is_active: memberActive,
    };
    // If entering an ID for the first time, require confirmation because it cannot be changed
    const existingIdNumber = editing === 'new' ? null : (editing as Member).id_number;
    const newIdNumber = values.id_number as string | null;
    if (newIdNumber && !existingIdNumber) {
      setPendingValues(values);
      setShowIdConfirm(true);
      return;
    }
    await doSave(values);
  };

  const confirmIdAndSave = async () => {
    setShowIdConfirm(false);
    if (pendingValues) await doSave(pendingValues);
    setPendingValues(null);
  };

  const cancelIdConfirm = () => { setShowIdConfirm(false); setPendingValues(null); };
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); notify(`Account reference ${text} copied.`); } catch { notify(`Account reference: ${text}`); } };
  const existingId = editing !== 'new' && editing ? (editing as Member).id_number : null;

  return <div className="page-enter space-y-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-[28px] font-extrabold tracking-[-1px]">Members</h1><p className="mt-1.5 text-xs text-[#929c95]">The people at the heart of your association.</p></div><div className="flex gap-2"><button className="btn btn-secondary" onClick={() => setImporting(true)}><FileUp size={15} />Import CSV</button><button className="btn btn-primary" onClick={() => open('new')}><Plus size={16} />Add member</button></div></div>
    <div className="card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0ed] px-5 py-4"><div className="flex flex-wrap gap-2"><select aria-label="Filter by pickup point" className="input !w-[205px]" value={point} onChange={e => { setPoint(e.target.value); setPage(1); }}><option value="">All pickup points</option>{points.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name.replace(/^STANRIDERS /, '')}{!p.is_active ? ' (inactive)' : ''}</option>)}</select><select aria-label="Filter by member status" className="input !w-[125px]" value={active} onChange={e => { setActive(e.target.value); setPage(1); }}><option value="all">All members</option><option value="active">Active only</option><option value="inactive">Inactive only</option></select></div><SearchInput className="w-full sm:w-[270px]" value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search name, ID, phone or QR…" /></div>
    {queryError ? <ErrorState message={queryError} retry={refresh} /> : !data ? <LoadingState /> : !data.items.length ? <EmptyState title={search || point ? 'No members found' : "Let's meet your riders"} description={search || point ? 'Try another name, ID, phone number, QR number or pickup point.' : 'Add a member individually or import your existing register from a CSV.'} action={<button className="btn btn-primary" onClick={() => open('new')}><Plus size={14} />Add member</button>} /> : <><div className={`table-wrap transition-opacity ${loading ? 'opacity-50' : ''}`}><table className="data-table"><thead><tr><th>Member</th><th>Pickup point</th><th>QR no.</th><th>Phone number</th><th>Payment reference</th><th>Status</th><th className="!text-right">Actions</th></tr></thead><tbody>{data.items.map((member, i) => <tr key={member.id}><td><div className="flex items-center gap-2.5"><Avatar name={member.full_name} index={i} /><div><span className="text-[11px] font-semibold text-[#52674f] dark:text-emerald-400">{member.full_name}</span>{member.id_number && <span className="block font-mono text-[9.5px] text-slate-500 dark:text-slate-400">ID: {member.id_number}</span>}</div></div></td><td><span className="badge badge-gray !text-[9px]">{member.pickup_points?.code || '—'}</span></td><td className="font-mono !text-[11px] text-[#84937c]">{member.qr_number}</td><td className="!text-[11px] text-[#87947f]">{displayPhone(member.phone)}</td><td><button className="flex items-center gap-2 text-[10px] font-semibold text-[#68865c] hover:text-brand" onClick={() => copy(`${member.pickup_points?.code}#${member.qr_number}`)} title="Copy payment reference">{member.pickup_points?.code}#{member.qr_number}<Copy size={11} /></button></td><td><StatusBadge active={member.is_active} /></td><td className="!text-right"><button className="icon-button" onClick={() => open(member)} title={`Edit ${member.full_name}`} aria-label={`Edit ${member.full_name}`}><Pencil size={14} /></button></td></tr>)}</tbody></table></div><Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} /></>}
    </div><div className="flex items-start gap-2.5 rounded-lg border border-[#e3eae0] bg-[#f0f5ed] dark:border-slate-700 dark:bg-slate-800/80 p-4"><ShieldCheck size={17} className="shrink-0 text-[#89a37a] dark:text-emerald-400" /><div><p className="text-[11px] font-semibold text-[#6b835e] dark:text-emerald-300">No member logins. No unnecessary steps.</p><p className="mt-1 text-[10px] leading-relaxed text-[#96a18d] dark:text-slate-400">Members contribute using Paybill 234567 and their pickup code + # + QR number. You manage everything here.</p></div></div>
    {editing && <Modal title={editing === 'new' ? 'Welcome a new member' : 'Edit member details'} subtitle={editing === 'new' ? "A name, a pickup point, and a unique QR number. That's all it takes." : 'Keep your rider register accurate and up to date.'} onClose={() => setEditing(null)}><form onSubmit={save}><div className="space-y-4 p-6"><InlineError message={error} /><Field label="Full name"><input className="input" name="full_name" defaultValue={editing === 'new' ? '' : (editing as Member).full_name} placeholder="e.g. John Mwangi" minLength={2} maxLength={120} required autoComplete="name" /></Field><div className="grid grid-cols-[1fr_1fr] gap-4">
      <Field label="National ID Number" hint={existingId ? 'Locked — cannot be changed.' : 'Optional · 6–10 digits · Unique per member.'}>
        {existingId ? (
          <>
            <div className="input flex items-center gap-2 !cursor-not-allowed !bg-slate-50 dark:!bg-slate-800/60 opacity-80">
              <Lock size={13} className="shrink-0 text-slate-400" />
              <span className="font-mono text-[13px] text-slate-600 dark:text-slate-300 select-all">{existingId}</span>
            </div>
            <input type="hidden" name="id_number" value={existingId} />
          </>
        ) : (
          <input className="input font-mono" name="id_number" inputMode="numeric" defaultValue="" placeholder="e.g. 29384756" maxLength={10} pattern="[0-9]{6,10}" />
        )}
      </Field>
      <Field label="Pickup point"><select className="input" name="pickup_point_id" defaultValue={editing === 'new' ? point : (editing as Member).pickup_point_id} required><option value="" disabled>Select a pickup point</option>{points.map(p => <option key={p.id} value={p.id} disabled={!p.is_active}>{p.code} — {p.name}{!p.is_active ? ' (inactive)' : ''}</option>)}</select></Field></div><div className="grid grid-cols-[1.3fr_1fr] gap-4"><Field label="Phone number" hint="07xx xxx xxx, 01xx xxx xxx or +254"><input className="input" name="phone" type="tel" defaultValue={editing === 'new' ? '' : displayPhone((editing as Member).phone)} placeholder="0712 345 678" maxLength={20} required /></Field><Field label="QR number" hint="Digits only. Keep leading zeros."><input className="input font-mono" name="qr_number" inputMode="numeric" defaultValue={editing === 'new' ? '' : (editing as Member).qr_number} placeholder="001" maxLength={12} pattern="[0-9]{1,12}" required /></Field></div>{editing !== 'new' && <Toggle checked={memberActive} onChange={setMemberActive} label="Active member" description="Inactive members cannot receive new matched payments." />}{editing !== 'new' && <p className="text-[10px] leading-relaxed text-[#9aab92]">Changing a QR number affects future payments. Previously matched payments stay linked to this member.</p>}</div><div className="flex justify-end gap-2 border-t border-[#edf0ee] p-5"><button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" disabled={saving || !points.some(p => p.is_active)} type="submit">{saving ? <Spinner label="Saving…" /> : <><CheckCircle2 size={14} />{editing === 'new' ? 'Add member' : 'Save changes'}</>}</button></div>{!points.some(p => p.is_active) && <p className="px-6 pb-4 text-xs text-[#b18b57]">Add or activate a pickup point before adding members.</p>}</form></Modal>}
    {importing && <ImportMembers points={points} onClose={() => setImporting(false)} onImported={count => { setImporting(false); refresh(); refreshPoints(); notify(`${count.toLocaleString()} members imported successfully.`); }} />}
    {showIdConfirm && pendingValues && <IdConfirmModal idNumber={String(pendingValues.id_number)} onConfirm={confirmIdAndSave} onCancel={cancelIdConfirm} />}
  </div>;
}
