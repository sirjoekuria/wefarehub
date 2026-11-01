'use client';
import { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Mail, 
  Phone, 
  RotateCcw, 
  ShieldAlert, 
  ShieldCheck, 
  Sparkles, 
  UserCheck, 
  UserX, 
  Users 
} from 'lucide-react';
import type { OfficialUser } from '@/lib/types';
import { Avatar, EmptyState, ErrorState, LoadingState, Spinner } from './ui';

export function Officials({ 
  notify, 
  adminEmail 
}: { 
  notify: (msg: string, err?: boolean) => void; 
  adminEmail: string; 
}) {
  const [officials, setOfficials] = useState<OfficialUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'suspended'>('all');

  const fetchOfficials = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/officials', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load officials');
      setOfficials(data.officials || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load officials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficials();
  }, []);

  const handleAction = async (official: OfficialUser, action: 'approve' | 'suspend') => {
    setActionLoading(official.id);
    try {
      const res = await fetch('/api/auth/officials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          officialId: official.id,
          adminEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} official.`);

      notify(data.message || `Official ${action}d successfully!`);
      await fetchOfficials();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Action failed.`;
      notify(msg, true);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingList = officials.filter(o => !o.approved && o.approval_status === 'pending');
  const filteredOfficials = officials.filter(o => {
    if (filter === 'pending') return !o.approved && o.approval_status === 'pending';
    if (filter === 'approved') return o.approved;
    if (filter === 'suspended') return o.approval_status === 'suspended';
    return true;
  });

  return (
    <div className="page-enter space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-1px] text-slate-900 dark:text-white">
            Association Officials
          </h1>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Review, authorize, and approve newly registered welfare administrators and committee executives.
          </p>
        </div>

        <button
          onClick={fetchOfficials}
          disabled={loading}
          className="btn btn-secondary !py-2 !text-xs font-bold"
        >
          <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh List
        </button>
      </div>

      {/* Pending Banner Alert if any pending approval */}
      {pendingList.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-5 shadow-sm dark:border-amber-800 dark:bg-amber-950/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                <Clock size={20} className="animate-pulse" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
                  {pendingList.length} Official Registration{pendingList.length > 1 ? 's' : ''} Awaiting Your Approval
                </h3>
                <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300/90">
                  Signed-up officials cannot log into the workspace until an authorized administrator verifies their credentials.
                </p>
              </div>
            </div>

            <button
              onClick={() => setFilter('pending')}
              className="btn btn-primary self-start !min-h-9 !py-1.5 !text-xs font-bold sm:self-auto"
            >
              Review Pending ({pendingList.length})
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            filter === 'all'
              ? 'bg-[#167653] text-white shadow-xs'
              : 'text-slate-600 hover:bg-white/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          All Officials ({officials.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`relative rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            filter === 'pending'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 hover:bg-white/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          Pending Approval
          {pendingList.length > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-900">
              {pendingList.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter('approved')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            filter === 'approved'
              ? 'bg-[#167653] text-white shadow-xs'
              : 'text-slate-600 hover:bg-white/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          Approved ({officials.filter(o => o.approved).length})
        </button>
        <button
          onClick={() => setFilter('suspended')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            filter === 'suspended'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-white/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          Suspended ({officials.filter(o => o.approval_status === 'suspended').length})
        </button>
      </div>

      {/* Main Table / Grid Card */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <Spinner label="Loading registered officials…" />
          </div>
        ) : error ? (
          <ErrorState message={error} retry={fetchOfficials} />
        ) : filteredOfficials.length === 0 ? (
          <EmptyState
            title={filter === 'pending' ? 'No pending approval requests' : 'No officials found'}
            description={
              filter === 'pending'
                ? 'All registered officials have been reviewed. When new officials register via /signup, they will appear here.'
                : 'Share the /signup link with committee officials to register their access.'
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Official</th>
                  <th>Designated Role</th>
                  <th>Contact Details</th>
                  <th>Status</th>
                  <th>Approved By</th>
                  <th className="!text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOfficials.map((official, idx) => {
                  const isPending = !official.approved && official.approval_status === 'pending';
                  const isSuspended = official.approval_status === 'suspended';
                  const isActionBusy = actionLoading === official.id;

                  return (
                    <tr key={official.id}>
                      {/* Name & Super Admin tag */}
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={official.full_name} index={idx} />
                          <div>
                            <span className="text-[13px] font-bold text-slate-900 dark:text-white">
                              {official.full_name}
                            </span>
                            {official.is_super_admin && (
                              <span className="ml-2 inline-flex items-center rounded-md bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-black uppercase text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Super Admin
                              </span>
                            )}
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                              Registered: {new Date(official.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Official Role */}
                      <td>
                        <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-extrabold text-slate-800 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {official.role}
                        </span>
                      </td>

                      {/* Contact Info */}
                      <td>
                        <div className="space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Mail size={12} className="text-slate-400" />
                            <span>{official.email}</span>
                          </div>
                          {official.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone size={12} className="text-slate-400" />
                              <span className="font-mono">{official.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Approval Status Badge */}
                      <td>
                        {isPending ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Pending Approval
                          </span>
                        ) : isSuspended ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 size={12} />
                            Active & Approved
                          </span>
                        )}
                      </td>

                      {/* Approved By info */}
                      <td>
                        <span className="text-[11.5px] text-slate-600 dark:text-slate-400">
                          {official.approved_by ? (
                            <>
                              <strong className="text-slate-800 dark:text-slate-200">{official.approved_by}</strong>
                              {official.approved_at && (
                                <span className="block text-[10px] text-slate-500">
                                  {new Date(official.approved_at).toLocaleDateString()}
                                </span>
                              )}
                            </>
                          ) : (
                            '—'
                          )}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="!text-right">
                        {official.is_super_admin ? (
                          <span className="text-[11px] font-bold text-slate-400 italic">
                            Protected Root Admin
                          </span>
                        ) : isPending ? (
                          <button
                            onClick={() => handleAction(official, 'approve')}
                            disabled={isActionBusy}
                            className="btn btn-primary !min-h-8 !py-1 !px-3 !text-xs font-bold"
                          >
                            {isActionBusy ? (
                              <Spinner label="Approving…" />
                            ) : (
                              <>
                                <CheckCircle2 size={13} />
                                Approve Official
                              </>
                            )}
                          </button>
                        ) : isSuspended ? (
                          <button
                            onClick={() => handleAction(official, 'approve')}
                            disabled={isActionBusy}
                            className="btn btn-secondary !min-h-8 !py-1 !px-3 !text-xs font-bold"
                          >
                            {isActionBusy ? (
                              <Spinner label="Re-activating…" />
                            ) : (
                              <>
                                <CheckCircle2 size={13} className="text-emerald-600" />
                                Re-approve
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAction(official, 'suspend')}
                            disabled={isActionBusy}
                            className="btn btn-ghost !min-h-8 !py-1 !px-2.5 !text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
                          >
                            {isActionBusy ? (
                              <Spinner label="Suspending…" />
                            ) : (
                              <>
                                <UserX size={13} />
                                Suspend Access
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Security notice & Audit assurance */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/70 p-4 text-xs dark:border-slate-800 dark:bg-slate-900/60">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#167653] dark:text-emerald-400" />
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-200">
            Immutable Audit Trail Compliance
          </p>
          <p className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-400">
            Every approval and suspension is signed with your administrator identity (<strong className="text-slate-900 dark:text-white">{adminEmail}</strong>) and permanently recorded in the Audit Logs for association compliance and transparency.
          </p>
        </div>
      </div>
    </div>
  );
}
