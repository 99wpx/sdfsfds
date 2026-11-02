import { supabase } from '@/lib/supabase';
import { fetchUserSummaries } from '@/lib/admin-queries';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { AdminLedgerRow } from '@/types/models';
import type { LedgerEntry } from '@/types/models';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { LedgerTable } from '@/components/ledger/LedgerTable';

async function loadLedger(): Promise<AdminLedgerRow[]> {
  const { data, error } = await supabase
    .from('wallet_ledger')
    .select('id, user_id, wallet_id, entry_type, amount, balance_after, reference_id, description, created_at')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as LedgerEntry[];
  const agents = await fetchUserSummaries(rows.map((row) => row.user_id));
  return rows.map((row) => ({ ...row, agent_name: agents.get(row.user_id)?.full_name ?? 'Agen tidak dikenal' }));
}

export function AdminLedgerPage() {
  const { data, error, loading, reload } = useAsyncData(loadLedger, []);

  return (
    <>
      <PageHeader title="Mutasi dompet" description="Catatan seluruh pergerakan saldo agen. Data bersifat tetap dan tidak dapat diubah." />

      <Card padding="none">
        {loading && <LoadingState />}
        {!loading && error && (
          <div className="p-5">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}
        {!loading && !error && data && data.length === 0 && (
          <EmptyState title="Belum ada mutasi" description="Deposit yang disetujui dan transaksi agen akan tercatat di sini." />
        )}
        {!loading && !error && data && data.length > 0 && <LedgerTable rows={data} showAgent />}
      </Card>
    </>
  );
}
