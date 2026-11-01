'use client';
import { useState, type ReactNode } from 'react';
import { ArrowUpRight, Bike, ChevronRight, CircleHelp, FileBarChart2, HeartHandshake, HeartPulse, LayoutDashboard, LogOut, MapPin, Menu, ScrollText, ShieldCheck, UsersRound, Wallet, X } from 'lucide-react';
import type { Screen, SessionUser } from '@/lib/types';
import { PAYBILL } from '@/lib/utils';

export const screenNames: Record<Screen, string> = { 
  dashboard: 'Dashboard', 
  'pickup-points': 'Pickup Points', 
  members: 'Members', 
  payments: 'Payments', 
  reports: 'Reports', 
  cases: 'Welfare Cases',
  audit: 'Audit Logs',
};
const navigation = [
  { id: 'dashboard' as Screen, icon: LayoutDashboard }, 
  { id: 'pickup-points' as Screen, icon: MapPin }, 
  { id: 'members' as Screen, icon: UsersRound }, 
  { id: 'payments' as Screen, icon: Wallet }, 
  { id: 'reports' as Screen, icon: FileBarChart2 }, 
  { id: 'cases' as Screen, icon: HeartPulse },
  { id: 'audit' as Screen, icon: ScrollText },
];
export function Brand({ light = false }: { light?: boolean }) { return <div className="flex items-center gap-2.5"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${light ? 'bg-white/10 text-white' : 'bg-[#1b6548] text-white'}`}><Bike size={26} strokeWidth={1.7} /></span><div><span className={`display block text-[17px] font-extrabold tracking-[.045em] ${light ? 'text-white' : 'text-[#234834]'}`}>ROCS CREW<span className="ml-0.5 align-top text-[8px]">™</span></span><span className={`mt-0.5 block text-[8px] font-medium tracking-[.08em] ${light ? 'text-white/55' : 'text-[#8d9a90]'}`}>RIDERS WELFARE ASSOCIATION</span></div></div>; }
export function AdminShell({ children, screen, navigate, user, unmatched, onLogout, onGuide }: { children: ReactNode; screen: Screen; navigate: (s: Screen) => void; user: SessionUser; unmatched: number; onLogout: () => void; onGuide: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = (s: Screen) => { navigate(s); setMobileOpen(false); };
  return <div className="min-h-screen">
    {mobileOpen && <div className="fixed inset-0 z-40 bg-[#153425]/40 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col border-r border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-[4px_0_24px_rgba(15,23,42,0.06)] transition-transform duration-250 lg:translate-x-0 ${mobileOpen ? 'translate-x-0 visible' : '-translate-x-full invisible lg:visible'}`}>
      <div className="flex h-[86px] shrink-0 items-center px-6"><Brand /><button className="icon-button ml-auto lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={17} /></button></div>
      <div className="mx-5 mt-5 flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 shadow-xs px-3 py-2.5"><span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" /><span className="text-[12px] font-bold text-[#0f172a]">Admin workspace</span><ShieldCheck size={14} className="ml-auto text-[#167653]" /></div>
      <div className="px-7 pb-2 pt-7 text-[10px] font-bold tracking-[.15em] text-[#64748b]">WORKSPACE</div>
      <nav aria-label="Main navigation" className="space-y-1.5 px-4">{navigation.map(({ id, icon: Icon }) => <button key={id} onClick={() => nav(id)} className={`nav-item ${screen === id ? 'active' : ''}`} aria-current={screen === id ? 'page' : undefined}><Icon size={19} strokeWidth={screen === id ? 2.2 : 1.7} /><span>{screenNames[id]}</span>{id === 'payments' && unmatched > 0 && <span className="ml-auto rounded-md bg-[#fef3c7] px-2 py-0.5 text-[11px] font-bold text-[#92400e] shadow-xs">{unmatched}</span>}{screen === id && id !== 'payments' && <span className="ml-auto h-2 w-2 rounded-full bg-[#16a34a]" />}</button>)}</nav>
      <div className="mt-auto px-5 pb-5 pt-10"><div className="relative overflow-hidden rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white/90 p-4 shadow-sm"><HeartHandshake size={24} strokeWidth={1.8} className="mb-3 text-[#167653]" /><h3 className="text-[13px] font-extrabold text-[#0f172a]">Stronger, together.</h3><p className="mt-1.5 text-[11.5px] font-medium leading-[1.6] text-[#475569]">Small contributions.<br />A lasting difference for our riders.</p><div className="mt-4 flex items-center gap-1.5 border-t border-emerald-100 pt-3 text-[10px] font-bold tracking-wide text-[#166534]"><ShieldCheck size={13} /> EVERY SHILLING COUNTS</div></div><button onClick={onGuide} className="mt-5 flex w-full items-center gap-2.5 px-2 text-[12.5px] font-bold text-[#475569] hover:text-brand"><CircleHelp size={17} />Payment guide<ArrowUpRight size={14} className="ml-auto" /></button></div>
      <div className="flex items-center gap-2.5 border-t border-slate-200/80 px-5 py-5 bg-white/60"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[11.5px] font-bold text-[#0f172a] shadow-xs">AD</span><div className="min-w-0"><p className="text-[12.5px] font-bold text-[#0f172a]">Association Admin</p><p className="mt-0.5 max-w-[135px] truncate text-[10.5px] font-medium text-[#64748b]" title={user.email}>{user.email}</p></div>{user.demo ? <span className="ml-auto text-[#167653]" title="Demo access" aria-label="Demo access"><ShieldCheck size={16} /></span> : <button className="icon-button ml-auto !w-7" onClick={onLogout} title="Sign out" aria-label="Sign out"><LogOut size={16} /></button>}</div>
    </aside>
    <div className="lg:ml-[250px]"><header className="sticky top-0 z-30 flex h-[73px] items-center justify-between gap-3 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl px-5 md:px-8 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.05)]"><div className="flex items-center gap-3"><button className="icon-button lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={22} /></button><span className="hidden text-[12px] font-semibold text-[#64748b] sm:inline">Workspace</span><ChevronRight size={13} className="hidden text-[#94a3b8] sm:block" /><span className="text-[13px] font-extrabold text-[#0f172a]">{screenNames[screen]}</span></div><div className="flex items-center gap-4"><span className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold sm:inline-flex shadow-xs ${user.demo ? 'border-slate-200 bg-white text-[#475569]' : 'border-emerald-200 bg-emerald-50 text-[#166534]'}`}><span className="live-dot" />{user.demo ? 'Demo workspace' : 'Admin access'}</span><span className="hidden h-5 w-px bg-slate-200 md:block" /><button onClick={onGuide} className="flex items-center gap-1.5 text-[12px] font-bold text-[#475569] hover:text-brand"><CircleHelp size={17} /><span className="hidden md:inline">Payment guide</span></button><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-full border-[2px] border-white bg-[#f1f5f9] text-[11.5px] font-bold text-[#0f172a] shadow-xs">AD</span><span className="hidden text-[12px] font-bold text-[#0f172a] md:block">Admin</span></div></div></header>
      <main className="main-content mx-auto max-w-[1660px] px-5 py-7 md:px-8 md:py-8">{children}<footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-[#475569]"><span>© {new Date().getFullYear()} ROCS CREW Welfare Association</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />{user.demo ? 'Sample data · Not connected to M-Pesa' : `M-Pesa Paybill ${PAYBILL}`}</span></footer></main>
    </div>
  </div>;
}
