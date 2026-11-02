import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { LedgerEntryType } from '@/types/models';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { LedgerTypeBadge } from '@/components/ui/StatusBadge';
import { DataTable, type Column } from '@/components/ui/DataTable';

export interface LedgerRow {
  id: string;
  entry_type: LedgerEntryType;
  amount: number;
  balance_after: number;
  description: string;
  reference_id: string;
  created_at: string;
  agent_name?: string;
}

export function LedgerTable({ rows, showAgent = false }: { rows: LedgerRow[]; showAgent?: boolean }) {
  const columns: Column<LedgerRow>[] = [
    { header: 'Waktu', cell: (row) => <span className="whitespace-nowrap text-gray-600">{formatDateTime(row.created_at)}</span> },
    ...(showAgent ? [{ header: 'Agen', cell: (row: LedgerRow) => <span className="font-medium text-gray-900">{row.agent_name}</span> }] : []),
    { header: 'Jenis', cell: (row) => <LedgerTypeBadge type={row.entry_type} /> },
    {
      header: 'Keterangan',
      cell: (row) => (
        <div className="min-w-[180px]">
          <p className="text-gray-900">{row.description || '-'}</p>
          <p className="font-mono text-xs text-gray-400">{row.reference_id}</p>
        </div>
      ),
    },
    {
      header: 'Nominal',
      align: 'right',
      cell: (row) => {
        const positive = row.amount > 0;
        return (
          <span className={`inline-flex items-center gap-1 whitespace-nowrap font-semibold ${positive ? 'text-emerald-700' : 'text-rose-600'}`}>
            {positive ? <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />}
            {positive ? '+' : '-'}
            {formatRupiah(Math.abs(row.amount))}
          </span>
        );
      },
    },
    { header: 'Saldo akhir', align: 'right', cell: (row) => <span className="whitespace-nowrap text-gray-900">{formatRupiah(row.balance_after)}</span> },
  ];

  return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
