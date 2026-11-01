'use client';
import { useState, type ReactNode } from 'react';
import { ArrowUpRight, Bike, ChevronRight, CircleHelp, FileBarChart2, HeartHandshake, HeartPulse, LayoutDashboard, LogOut, MapPin, Menu, ScrollText, ShieldCheck, UserCheck, UsersRound, Wallet, X } from 'lucide-react';
import type { Screen, SessionUser } from '@/lib/types';
import { PAYBILL } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';

export const screenNames: Record<Screen, string> = { 
  dashboard: 'Dashboard', 
  'pickup-points': 'Pickup Points', 
  members: 'Members', 
  payments: 'Payments', 
  reports: 'Reports', 
  cases: 'Welfare Cases',
  officials: 'Officials',
  audit: 'Audit Logs',
};
const navigation = [
  { id: 'dashboard' as Screen, icon: LayoutDashboard }, 
  { id: 'pickup-points' as Screen, icon: MapPin }, 
  { id: 'members' as Screen, icon: UsersRound }, 
  { id: 'payments' as Screen, icon: Wallet }, 
  { id: 'reports' as Screen, icon: FileBarChart2 }, 
  { id: 'cases' as Screen, icon: HeartPulse },
  { id: 'officials' as Screen, icon: UserCheck },
  { id: 'audit' as Screen, icon: ScrollText },
];
export function Brand({ light = false }: { light?: boolean }) { return <div className="flex items-center gap-2.5"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${light ? 'bg-white/10 text-white' : 'bg-[#1b6548] text-white'}`}><Bike size={26} strokeWidth={1.7} /></span><div><span className={`display block text-[17px] font-extrabold tracking-[.045em] ${light ? 'text-white' : 'text-[#234834]'}`}>ROCS CREW<span className="ml-0.5 align-top text-[8px]">™</span></span><span className={`mt-0.5 block text-[8px] font-medium tracking-[.08em] ${light ? 'text-white/55' : 'text-[#8d9a90]'}`}>RIDERS WELFARE ASSOCIATION</span></div></div>; }
export function AdminShell({ children, screen, navigate, user, unmatched, pendingOfficials = 0, onLogout, onGuide }: { children: ReactNode; screen: Screen; navigate: (s: Screen) => void; user: SessionUser; unmatched: number; pendingOfficials?: number; onLogout: () => void; onGuide: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = (s: Screen) => { navigate(s); setMobileOpen(false); };
  return <div className="min-h-screen">
    {mobileOpen && <div className="fixed inset-0 z-40 bg-[#153425]/40 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col overflow-y-auto border-r border-slate-200/80 bg-white/95 dark:bg-slate-900/95 dark:border-slate-800 backdrop-blur-xl shadow-[4px_0_24px_rgba(15,23,42,0.06)] transition-transform duration-250 lg:translate-x-0 ${mobileOpen ? 'translate-x-0 visible' : '-translate-x-full invisible lg:visible'}`}>
      <div className="flex h-[86px] shrink-0 items-center px-6"><Brand /><button className="icon-button ml-auto lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={17} /></button></div>
      <div className="mx-5 mt-2 flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 dark:border-slate-700 dark:bg-slate-800/80 shadow-xs px-3 py-2.5"><span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" /><span className="text-[12px] font-bold text-slate-900 dark:text-white">Admin workspace</span><ShieldCheck size={14} className="ml-auto text-[#167653] dark:text-emerald-400" /></div>
      <div className="px-7 pb-2 pt-5 text-[10px] font-bold tracking-[.15em] text-[#64748b] dark:text-slate-400">WORKSPACE</div>
      <nav aria-label="Main navigation" className="space-y-1.5 px-4">{navigation.map(({ id, icon: Icon }) => <button key={id} onClick={() => nav(id)} className={`nav-item ${screen === id ? 'active' : ''}`} aria-current={screen === id ? 'page' : undefined}><Icon size={19} strokeWidth={screen === id ? 2.2 : 1.7} /><span>{screenNames[id]}</span>{id === 'payments' && unmatched > 0 && <span className="ml-auto rounded-md bg-[#fef3c7] dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 text-[11px] font-bold text-[#92400e] shadow-xs">{unmatched}</span>}{id === 'officials' && pendingOfficials > 0 && <span className="ml-auto rounded-md bg-amber-100 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 text-[11px] font-bold text-amber-900 shadow-xs">{pendingOfficials}</span>}{screen === id && id !== 'payments' && id !== 'officials' && <span className="ml-auto h-2 w-2 rounded-full bg-[#16a34a]" />}</button>)}</nav>
      <div className="mt-auto px-5 pb-4 pt-6"><button onClick={onGuide} className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/70 dark:border-slate-700 dark:bg-slate-800/80 px-3 py-2.5 text-[12.5px] font-bold text-slate-700 dark:text-slate-300 hover:text-brand shadow-xs"><CircleHelp size={17} />Payment guide<ArrowUpRight size={14} className="ml-auto" /></button></div>
      <div className="flex items-center gap-2.5 border-t border-slate-200/80 dark:border-slate-800 px-5 py-4 bg-white/60 dark:bg-slate-900/60"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] dark:bg-slate-800 text-[11.5px] font-bold text-slate-900 dark:text-white shadow-xs">AD</span><div className="min-w-0"><p className="text-[12.5px] font-bold text-slate-900 dark:text-white">Association Admin</p><p className="mt-0.5 max-w-[135px] truncate text-[10.5px] font-medium text-slate-500 dark:text-slate-400" title={user.email}>{user.email}</p></div>{user.demo ? <span className="ml-auto text-[#167653] dark:text-emerald-400" title="Demo access" aria-label="Demo access"><ShieldCheck size={16} /></span> : <button className="icon-button ml-auto !w-7" onClick={onLogout} title="Sign out" aria-label="Sign out"><LogOut size={16} /></button>}</div>
    </aside>
    <div className="lg:ml-[250px]"><header className="sticky top-0 z-30 flex h-[73px] items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl px-5 md:px-8 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.05)]"><div className="flex items-center gap-3"><button className="icon-button lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={22} /></button><span className="hidden text-[12px] font-semibold text-[#64748b] dark:text-slate-400 sm:inline">Workspace</span><ChevronRight size={13} className="hidden text-[#94a3b8] dark:text-slate-500 sm:block" /><span className="text-[13px] font-extrabold text-[#0f172a] dark:text-white">{screenNames[screen]}</span></div><div className="flex items-center gap-3"><ThemeToggle /><span className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold sm:inline-flex shadow-xs ${user.demo ? 'border-slate-200 bg-white text-[#475569] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300' : 'border-emerald-200 bg-emerald-50 text-[#166534] dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'}`}><span className="live-dot" />{user.demo ? 'Demo workspace' : 'Admin access'}</span><span className="hidden h-5 w-px bg-slate-200 dark:bg-slate-700 md:block" /><button onClick={onGuide} className="flex items-center gap-1.5 text-[12px] font-bold text-slate-700 dark:text-slate-300 hover:text-brand"><CircleHelp size={17} /><span className="hidden md:inline">Payment guide</span></button><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-full border-[2px] border-white dark:border-slate-700 bg-[#f1f5f9] dark:bg-slate-800 text-[11.5px] font-bold text-[#0f172a] dark:text-white shadow-xs">AD</span><span className="hidden text-[12px] font-bold text-[#0f172a] dark:text-white md:block">Admin</span></div></div></header>
      <main className="main-content mx-auto max-w-[1660px] px-5 py-7 md:px-8 md:py-8">{children}<footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-400"><span>© {new Date().getFullYear()} ROCS CREW Welfare Association</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />{user.demo ? 'Sample data · Not connected to M-Pesa' : `M-Pesa Paybill ${PAYBILL}`}</span></footer></main>
    </div>
  </div>;
}
