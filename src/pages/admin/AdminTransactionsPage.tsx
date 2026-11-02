import { supabase } from '@/lib/supabase';
import { fetchUserSummaries } from '@/lib/admin-queries';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { AdminTransactionRow } from '@/types/models';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TransactionStatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';

export interface AdminTransactionView extends AdminTransactionRow {
  agent_name: string;
}

async function loadTransactions(): Promise<AdminTransactionView[]> {
  const { data, error } = await supabase.rpc('admin_list_transactions', { p_limit: 200 });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as AdminTransactionRow[];
  const agents = await fetchUserSummaries(rows.map((row) => row.user_id));
  return rows.map((row) => ({ ...row, agent_name: agents.get(row.user_id)?.full_name ?? 'Agen tidak dikenal' }));
}

const columns: Column<AdminTransactionView>[] = [
  { header: 'Waktu', cell: (tx) => <span className="whitespace-nowrap text-gray-600">{formatDateTime(tx.created_at)}</span> },
  {
    header: 'Produk',
    cell: (tx) => (
      <div className="min-w-[180px]">
        <p className="font-medium text-gray-900">{tx.product_name}</p>
        <p className="font-mono text-xs text-gray-400">{tx.reference_id}</p>
      </div>
    ),
  },
  { header: 'Agen', cell: (tx) => <span className="text-gray-900">{tx.agent_name}</span> },
  { header: 'Nomor tujuan', cell: (tx) => <span className="font-mono text-gray-700">{tx.customer_no}</span> },
  { header: 'Status', cell: (tx) => <TransactionStatusBadge status={tx.status} /> },
  { header: 'Modal', align: 'right', cell: (tx) => <span className="whitespace-nowrap text-gray-600">{formatRupiah(tx.supplier_price)}</span> },
  { header: 'Harga jual', align: 'right', cell: (tx) => <span className="whitespace-nowrap text-gray-900">{formatRupiah(tx.selling_price)}</span> },
  { header: 'Laba', align: 'right', cell: (tx) => <span className="whitespace-nowrap font-semibold text-emerald-700">{formatRupiah(tx.profit)}</span> },
];

export function AdminTransactionsPage() {
  const { data, error, loading, reload } = useAsyncData(loadTransactions, []);

  return (
    <>
      <PageHeader title="Monitor transaksi" description="Seluruh transaksi PPOB agen beserta modal dan laba kotor." />

      <Card padding="none">
        {loading && <LoadingState />}
        {!loading && error && (
          <div className="p-5">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}
        {!loading && !error && data && data.length === 0 && (
          <EmptyState title="Belum ada transaksi" description="Transaksi PPOB agen akan tampil di sini." />
        )}
        {!loading && !error && data && data.length > 0 && <DataTable columns={columns} rows={data} rowKey={(tx) => tx.id} />}
      </Card>
    </>
  );
}
