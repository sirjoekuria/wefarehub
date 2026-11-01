import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = { title: 'ROCS CREW — Riders Welfare Contribution System', description: 'A stronger community, one contribution at a time. Manage pickup points, riders and M-Pesa welfare contributions.' };
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
