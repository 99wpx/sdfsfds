import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchUserSummaries } from '@/lib/admin-queries';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { AdminDepositRow, Deposit, DepositStatus } from '@/types/models';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { DepositStatusBadge } from '@/components/ui/StatusBadge';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { DepositReviewModal } from '@/components/admin/DepositReviewModal';

type StatusFilter = DepositStatus | 'all';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Menunggu' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
  { value: 'all', label: 'Semua' },
];

async function loadDeposits(filter: StatusFilter): Promise<AdminDepositRow[]> {
  let query = supabase
    .from('deposits')
    .select('id, user_id, bank_account_id, amount, receipt_path, status, admin_note, reviewed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (filter !== 'all') {
    query = query.eq('status', filter);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Deposit[];
  const agents = await fetchUserSummaries(rows.map((row) => row.user_id));
  return rows.map((row) => ({
    ...row,
    agent_name: agents.get(row.user_id)?.full_name ?? 'Agen tidak dikenal',
    agent_email: agents.get(row.user_id)?.email ?? '-',
  }));
}

export function AdminDepositsPage() {
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const { data, error, loading, reload } = useAsyncData(() => loadDeposits(filter), [filter]);
  const [selected, setSelected] = useState<AdminDepositRow | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleReviewed = () => {
    const decided = selected;
    setSelected(null);
    setSuccessMessage(
      decided ? `Deposit ${decided.agent_name} sebesar ${formatRupiah(decided.amount)} berhasil diproses.` : 'Deposit berhasil diproses.',
    );
    reload();
  };

  const columns: Column<AdminDepositRow>[] = [
    { header: 'Waktu', cell: (row) => <span className="whitespace-nowrap text-gray-600">{formatDateTime(row.created_at)}</span> },
    {
      header: 'Agen',
      cell: (row) => (
        <div className="min-w-[160px]">
          <p className="font-medium text-gray-900">{row.agent_name}</p>
          <p className="text-xs text-gray-500">{row.agent_email}</p>
        </div>
      ),
    },
    { header: 'Nominal', align: 'right', cell: (row) => <span className="whitespace-nowrap font-semibold text-gray-900">{formatRupiah(row.amount)}</span> },
    { header: 'Status', cell: (row) => <DepositStatusBadge status={row.status} /> },
    {
      header: '',
      align: 'right',
      cell: (row) => (
        <button
          type="button"
          onClick={() => setSelected(row)}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
        >
          {row.status === 'pending' ? 'Verifikasi' : 'Lihat detail'}
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Verifikasi deposit" description="Periksa bukti transfer agen lalu setujui atau tolak deposit." />

      <div className="mb-6 flex flex-wrap gap-2" role="tablist">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors ${
              filter === option.value ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-gray-600 ring-gray-200 hover:ring-emerald-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {successMessage && (
        <div className="mb-6">
          <Alert tone="success">{successMessage}</Alert>
        </div>
      )}

      <Card padding="none">
        {loading && <LoadingState />}
        {!loading && error && (
          <div className="p-5">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}
        {!loading && !error && data && data.length === 0 && (
          <EmptyState title="Tidak ada deposit" description="Deposit dengan status ini belum tersedia." />
        )}
        {!loading && !error && data && data.length > 0 && <DataTable columns={columns} rows={data} rowKey={(row) => row.id} />}
      </Card>

      {selected && <DepositReviewModal deposit={selected} onClose={() => setSelected(null)} onReviewed={handleReviewed} />}
    </>
  );
}
