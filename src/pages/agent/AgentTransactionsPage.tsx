import { supabase } from '@/lib/supabase';
import { TRANSACTION_COLUMNS } from '@/lib/queries';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { TransactionRow } from '@/types/models';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TransactionStatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';

async function loadTransactions(): Promise<TransactionRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as TransactionRow[];
}

const columns: Column<TransactionRow>[] = [
  { header: 'Waktu', cell: (tx) => <span className="whitespace-nowrap text-gray-600">{formatDateTime(tx.created_at)}</span> },
  {
    header: 'Produk',
    cell: (tx) => (
      <div className="min-w-[160px]">
        <p className="font-medium text-gray-900">{tx.product_name}</p>
        <p className="font-mono text-xs text-gray-400">{tx.reference_id}</p>
      </div>
    ),
  },
  { header: 'Nomor tujuan', cell: (tx) => <span className="font-mono text-gray-700">{tx.customer_no}</span> },
  { header: 'Status', cell: (tx) => <TransactionStatusBadge status={tx.status} /> },
  { header: 'Harga', align: 'right', cell: (tx) => <span className="whitespace-nowrap font-semibold text-gray-900">{formatRupiah(tx.selling_price)}</span> },
];

export function AgentTransactionsPage() {
  const { data, error, loading, reload } = useAsyncData(loadTransactions, []);

  return (
    <>
      <PageHeader title="Riwayat transaksi" description="Daftar seluruh transaksi PPOB yang pernah Anda lakukan." />

      <Card padding="none">
        {loading && <LoadingState />}
        {!loading && error && (
          <div className="p-5">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}
        {!loading && !error && data && data.length === 0 && (
          <EmptyState title="Belum ada transaksi" description="Transaksi PPOB Anda akan tercatat di sini." />
        )}
        {!loading && !error && data && data.length > 0 && <DataTable columns={columns} rows={data} rowKey={(tx) => tx.id} />}
      </Card>
    </>
  );
}
