'use client';
import { useState } from 'react';
import { 
  Activity, 
  ArrowRight, 
  Calendar, 
  Check, 
  Clock, 
  CreditCard, 
  Eye, 
  FileText, 
  Filter, 
  HeartHandshake, 
  Lock, 
  MapPin, 
  RefreshCw, 
  Search, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  UserCheck, 
  Users, 
  X 
} from 'lucide-react';
import { list } from '@/lib/api';
import { dateLabel, nairobiDate } from '@/lib/utils';
import type { AuditLog } from '@/lib/types';
import { EmptyState, ErrorState, LoadingState, Modal, Pagination, SearchInput, useDebounced, useQuery } from './ui';

const CATEGORIES = [
  { id: 'all', label: 'All Activity', icon: Activity },
  { id: 'payments', label: 'Payments', icon: CreditCard, prefix: 'payment.' },
  { id: 'members', label: 'Members', icon: Users, prefix: 'member.' },
  { id: 'pickup_points', label: 'Pickup Points', icon: MapPin, prefix: 'pickup_point.' },
  { id: 'cases', label: 'Welfare Cases', icon: HeartHandshake, prefix: 'welfare_case.' },
  { id: 'auth', label: 'Security & Auth', icon: Lock, prefix: 'auth.' },
];

export function AuditLogs({ notify }: { notify: (msg: string, error?: boolean) => void }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [inspecting, setInspecting] = useState<AuditLog | null>(null);

  const debouncedSearch = useDebounced(search, 300);

  const filterObj = {
    page,
    pageSize: 15,
    search: debouncedSearch || undefined,
    from: from || undefined,
    to: to || undefined,
    entityType: category === 'all' ? undefined : category === 'cases' ? 'welfare_case' : category === 'pickup_points' ? 'pickup_point' : category,
  };

  const { data, loading, error, refresh } = useQuery(
    () => list<AuditLog>('audit-logs', filterObj),
    `audit-logs-${page}-${debouncedSearch}-${category}-${from}-${to}`
  );

  const getActionBadge = (action: string) => {
    if (action.includes('create') || action.includes('auto_match')) {
      return <span className="inline-flex items-center gap-1 rounded-md bg-[#dcfce7] px-2 py-0.5 text-[11px] font-bold text-[#166534]"><Check size={11} strokeWidth={2.5} />{action.toUpperCase()}</span>;
    }
    if (action.includes('update') || action.includes('manual_match')) {
      return <span className="inline-flex items-center gap-1 rounded-md bg-[#e0f2fe] px-2 py-0.5 text-[11px] font-bold text-[#0369a1]"><RefreshCw size={11} />{action.toUpperCase()}</span>;
    }
    if (action.includes('reset') || action.includes('unmatched')) {
      return <span className="inline-flex items-center gap-1 rounded-md bg-[#fef3c7] px-2 py-0.5 text-[11px] font-bold text-[#92400e]"><ShieldAlert size={11} />{action.toUpperCase()}</span>;
    }
    if (action.includes('close')) {
      return <span className="inline-flex items-center gap-1 rounded-md bg-[#f3e8ff] px-2 py-0.5 text-[11px] font-bold text-[#7e22ce]">{action.toUpperCase()}</span>;
    }
    return <span className="inline-flex items-center gap-1 rounded-md bg-[#f1f5f9] px-2 py-0.5 text-[11px] font-bold text-[#0f172a]"><Shield size={11} />{action.toUpperCase()}</span>;
  };

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-[28px] font-extrabold tracking-[-1px] text-[#0f172a]">Audit Logs</h1>
            <span className="rounded-md border border-[#cbd5e1] bg-white px-2 py-0.5 text-[11px] font-bold text-[#0f172a]">
              Immutable Trail
            </span>
          </div>
          <p className="text-[13px] font-medium text-[#475569]">
            Comprehensive security and operational activity log across members, payments, and system events.
          </p>
        </div>

        <button 
          onClick={refresh} 
          disabled={loading} 
          className="btn btn-secondary !py-2.5"
          title="Refresh audit events"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh trail
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card space-y-4 p-5">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#e2e8f0] pb-4">
          {CATEGORIES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setCategory(id); setPage(1); }}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-bold transition-all ${
                category === id 
                  ? 'bg-[#167653] text-white shadow-sm' 
                  : 'bg-[#f1f5f9] text-[#334155] hover:bg-[#e2e8f0] hover:text-[#0f172a]'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Search & Date Range */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_auto]">
          <SearchInput 
            value={search} 
            onChange={(v) => { setSearch(v); setPage(1); }} 
            placeholder="Search by actor, entity name, receipt or action…" 
          />

          <div className="flex items-center gap-2 rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[13px] text-[#0f172a]">
            <Calendar size={14} className="text-[#64748b]" />
            <input 
              type="date" 
              value={from} 
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              className="w-full bg-transparent font-medium text-[#0f172a] outline-none"
              title="From date"
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[13px] text-[#0f172a]">
            <Calendar size={14} className="text-[#64748b]" />
            <input 
              type="date" 
              value={to} 
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
              className="w-full bg-transparent font-medium text-[#0f172a] outline-none"
              title="To date"
            />
          </div>

          {(search || from || to || category !== 'all') && (
            <button
              onClick={() => { setSearch(''); setFrom(''); setTo(''); setCategory('all'); setPage(1); }}
              className="btn btn-ghost !px-3 !text-[13px] font-bold"
              title="Reset all filters"
            >
              <X size={14} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Table View */}
      <div className="card overflow-hidden">
        {error ? (
          <ErrorState message={error} retry={refresh} />
        ) : loading ? (
          <LoadingState rows={8} />
        ) : !data?.items.length ? (
          <EmptyState
            title="No audit events found"
            description={
              search || from || to || category !== 'all'
                ? "No log entries match the selected filters. Try broadening your search or resetting filters."
                : "Activity logs will automatically record here as administrative and payment operations occur."
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Target / Entity</th>
                    <th>Details</th>
                    <th className="!text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((log) => {
                    const paidDate = new Date(log.created_at);
                    const isSystem = log.actor_email?.toLowerCase().includes('webhook') || log.actor_email?.toLowerCase().includes('system');
                    return (
                      <tr key={log.id} className="hover:bg-[#f8fafc]">
                        {/* Timestamp */}
                        <td className="whitespace-nowrap font-medium text-[#0f172a]">
                          <div className="flex items-center gap-2">
                            <Clock size={13} className="text-[#64748b]" />
                            <span>
                              {paidDate.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}{' '}
                              <span className="font-semibold text-[#475569]">
                                {paidDate.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Africa/Nairobi' })}
                              </span>
                            </span>
                          </div>
                        </td>

                        {/* Actor */}
                        <td className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                              isSystem ? 'bg-[#e2e8f0] text-[#0f172a]' : 'bg-[#dcfce7] text-[#166534]'
                            }`}>
                              {isSystem ? <Shield size={13} /> : <UserCheck size={13} />}
                            </span>
                            <span className="font-semibold text-[#0f172a]" title={log.actor_email}>
                              {log.actor_email || 'System'}
                            </span>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="whitespace-nowrap">
                          {getActionBadge(log.action)}
                        </td>

                        {/* Entity */}
                        <td>
                          <div className="max-w-[260px] truncate font-semibold text-[#0f172a]">
                            {log.entity_name || log.entity_id || '—'}
                          </div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                            {log.entity_type}
                          </span>
                        </td>

                        {/* Summary Details */}
                        <td className="max-w-[320px]">
                          <div className="truncate text-[13px] text-[#334155]" title={JSON.stringify(log.details)}>
                            {Object.entries(log.details || {})
                              .filter(([k]) => !['user_agent'].includes(k))
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' · ') || 'No additional payload'}
                          </div>
                        </td>

                        {/* Inspect Button */}
                        <td className="!text-right">
                          <button
                            onClick={() => setInspecting(log)}
                            className="btn btn-secondary !h-8 !px-2.5 !py-1 text-[12px] font-bold"
                            title="Inspect full audit record"
                          >
                            <Eye size={13} />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              pageSize={data.pageSize}
              total={data.total}
              onChange={setPage}
            />
          </>
        )}
      </div>

      {/* Inspect Modal */}
      {inspecting && (
        <Modal
          title="Audit Entry Inspection"
          subtitle={`Action ID: ${inspecting.id}`}
          onClose={() => setInspecting(null)}
          wide
        >
          <div className="space-y-5 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3.5">
                <span className="text-[11px] font-bold uppercase text-[#64748b]">Action & Category</span>
                <p className="mt-1 flex items-center gap-2 text-[14px] font-bold text-[#0f172a]">
                  {getActionBadge(inspecting.action)}
                  <span className="text-[#64748b]">/</span>
                  <span className="uppercase text-[#0f172a]">{inspecting.entity_type}</span>
                </p>
              </div>

              <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3.5">
                <span className="text-[11px] font-bold uppercase text-[#64748b]">Actor & Authority</span>
                <p className="mt-1 font-bold text-[#0f172a]">
                  {inspecting.actor_email}
                </p>
              </div>

              <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3.5">
                <span className="text-[11px] font-bold uppercase text-[#64748b]">Timestamp (Nairobi)</span>
                <p className="mt-1 font-bold text-[#0f172a]">
                  {new Date(inspecting.created_at).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}
                </p>
              </div>

              <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3.5">
                <span className="text-[11px] font-bold uppercase text-[#64748b]">Target Entity</span>
                <p className="mt-1 font-bold text-[#0f172a]">
                  {inspecting.entity_name || inspecting.entity_id || 'N/A'}
                </p>
              </div>
            </div>

            <div>
              <span className="mb-2 block text-[12px] font-bold uppercase tracking-wider text-[#475569]">
                Structured Audit Details & Metadata
              </span>
              <pre className="max-h-[300px] overflow-auto rounded-lg border border-[#e2e8f0] bg-[#0f172a] p-4 font-mono text-[13px] text-[#f8fafc] shadow-inner">
                {JSON.stringify(inspecting.details || {}, null, 2)}
              </pre>
            </div>
          </div>

          <div className="flex justify-end border-t border-[#e2e8f0] p-4">
            <button className="btn btn-secondary" onClick={() => setInspecting(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
