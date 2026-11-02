import { useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { Deposit } from '@/types/models';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DepositStatusBadge } from '@/components/ui/StatusBadge';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { NewDepositModal } from '@/components/deposits/NewDepositModal';

async function loadDeposits(): Promise<Deposit[]> {
  const { data, error } = await supabase
    .from('deposits')
    .select('id, user_id, bank_account_id, amount, receipt_path, status, admin_note, reviewed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as Deposit[];
}

export function AgentDepositsPage() {
  const { data, error, loading, reload } = useAsyncData(loadDeposits, []);
  const [formOpen, setFormOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmitted = () => {
    setFormOpen(false);
    setSuccessMessage('Deposit berhasil dikirim. Admin akan memverifikasi bukti transfer Anda.');
    reload();
  };

  return (
    <>
      <PageHeader
        title="Deposit saldo"
        description="Kirim bukti transfer dan pantau status verifikasi deposit Anda."
        action={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Deposit baru
          </Button>
        }
      />

      {successMessage && (
        <div className="mb-6">
          <Alert tone="success">{successMessage}</Alert>
        </div>
      )}

      <Card padding="none">
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-gray-900">Riwayat deposit</h2>
        </div>

        {loading && <LoadingState />}
        {!loading && error && (
          <div className="p-5">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}
        {!loading && !error && data && data.length === 0 && (
          <EmptyState
            title="Belum ada deposit"
            description="Deposit yang Anda kirim akan tampil di sini beserta statusnya."
            action={
              <Button variant="secondary" onClick={() => setFormOpen(true)}>
                Buat deposit pertama
              </Button>
            }
          />
        )}
        {!loading && !error && data && data.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {data.map((deposit) => (
              <li key={deposit.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{formatRupiah(deposit.amount)}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(deposit.created_at)}</p>
                  {deposit.admin_note && <p className="mt-1 text-sm text-gray-600">Catatan admin: {deposit.admin_note}</p>}
                </div>
                <DepositStatusBadge status={deposit.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {formOpen && <NewDepositModal onClose={() => setFormOpen(false)} onSubmitted={handleSubmitted} />}
    </>
  );
}
