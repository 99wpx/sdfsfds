import { LayoutDashboard, ArrowDownToLine, Wallet, ReceiptText, UserCog, ShieldCheck, Users, BookOpenText, ListChecks, Landmark, Settings, ScrollText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '@/types/models';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const agentNav: NavItem[] = [
  { to: '/dashboard', label: 'Beranda', icon: LayoutDashboard },
  { to: '/deposit', label: 'Deposit Saldo', icon: ArrowDownToLine },
  { to: '/wallet', label: 'Mutasi Saldo', icon: Wallet },
  { to: '/transactions', label: 'Riwayat Transaksi', icon: ReceiptText },
  { to: '/profile', label: 'Profil & Keamanan', icon: UserCog },
];

export const adminNav: NavItem[] = [
  { to: '/admin', label: 'Ringkasan', icon: LayoutDashboard },
  { to: '/admin/deposits', label: 'Verifikasi Deposit', icon: ShieldCheck },
  { to: '/admin/agents', label: 'Agen', icon: Users },
  { to: '/admin/ledger', label: 'Mutasi Saldo', icon: BookOpenText },
  { to: '/admin/transactions', label: 'Transaksi PPOB', icon: ListChecks },
  { to: '/admin/bank-accounts', label: 'Rekening Bank', icon: Landmark },
  { to: '/admin/settings', label: 'Pengaturan', icon: Settings },
  { to: '/admin/audit-logs', label: 'Log Audit', icon: ScrollText },
];

export function homePathFor(role: UserRole): string {
  return role === 'admin' ? '/admin' : '/dashboard';
}

export function navFor(role: UserRole): NavItem[] {
  return role === 'admin' ? adminNav : agentNav;
}
