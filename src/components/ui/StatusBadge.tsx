import type { DepositStatus, LedgerEntryType, TransactionStatus, AccountStatus } from '@/types/models';

type BadgeTone = 'emerald' | 'amber' | 'rose' | 'gray' | 'sky';

const toneClasses: Record<BadgeTone, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/15',
  gray: 'bg-gray-100 text-gray-700 ring-gray-500/15',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/15',
};

export function Badge({ tone = 'gray', children }: { tone?: BadgeTone; children: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

const depositStatusLabel: Record<DepositStatus, string> = {
  pending: 'Menunggu verifikasi',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};
const depositStatusTone: Record<DepositStatus, BadgeTone> = {
  pending: 'amber',
  approved: 'emerald',
  rejected: 'rose',
};

export function DepositStatusBadge({ status }: { status: DepositStatus }) {
  return <Badge tone={depositStatusTone[status]}>{depositStatusLabel[status]}</Badge>;
}

const transactionStatusLabel: Record<TransactionStatus, string> = {
  pending: 'Diproses',
  success: 'Berhasil',
  failed: 'Gagal',
  refunded: 'Dikembalikan',
};
const transactionStatusTone: Record<TransactionStatus, BadgeTone> = {
  pending: 'sky',
  success: 'emerald',
  failed: 'rose',
  refunded: 'gray',
};

export function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
  return <Badge tone={transactionStatusTone[status]}>{transactionStatusLabel[status]}</Badge>;
}

const ledgerLabel: Record<LedgerEntryType, string> = {
  deposit: 'Deposit',
  purchase: 'Pembelian',
  refund: 'Pengembalian',
  adjustment: 'Penyesuaian',
};

export function LedgerTypeBadge({ type }: { type: LedgerEntryType }) {
  return <Badge tone={type === 'deposit' ? 'emerald' : type === 'adjustment' ? 'sky' : 'gray'}>{ledgerLabel[type]}</Badge>;
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return status === 'active' ? <Badge tone="emerald">Aktif</Badge> : <Badge tone="rose">Ditangguhkan</Badge>;
}
