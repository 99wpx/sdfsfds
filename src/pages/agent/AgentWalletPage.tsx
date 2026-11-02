import { Wallet } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { formatRupiah } from '@/lib/format';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { LedgerEntry, Wallet as WalletRow } from '@/types/models';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { LedgerTable, type LedgerRow } from '@/components/ledger/LedgerTable';

interface WalletData {
  balance: number;
  entries: LedgerEntry[];
}

async function loadWallet(): Promise<WalletData> {
  const [walletRes, ledgerRes] = await Promise.all([
    supabase.from('wallets').select('id, user_id, balance').maybeSingle(),
    supabase
      .from('wallet_ledger')
      .select('id, user_id, entry_type, amount, balance_after, reference_id, description, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);
  if (walletRes.error) throw new Error(walletRes.error.message);
  if (!walletRes.data) throw new Error('Dompet Anda belum tersedia');
  const wallet: WalletRow = walletRes.data;
  return { balance: wallet.balance, entries: unwrap<LedgerEntry[]>(ledgerRes) };
}

export function AgentWalletPage() {
  const { data, error, loading, reload } = useAsyncData(loadWallet, []);

  return (
    <>
      <PageHeader title="Mutasi saldo" description="Semua pergerakan saldo dompet Anda, dari deposit hingga pembelian." />

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data && (
        <div className="space-y-6">
          <StatCard label="Saldo saat ini" value={formatRupiah(data.balance)} icon={<Wallet className="h-[18px] w-[18px]" />} hint="Saldo dikelola otomatis oleh sistem" />

          <Card padding="none">
            <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
              <h2 className="text-base font-semibold text-gray-900">Riwayat mutasi</h2>
            </div>
            {data.entries.length === 0 ? (
              <EmptyState title="Belum ada mutasi" description="Deposit yang disetujui dan transaksi Anda akan tercatat di sini." />
            ) : (
              <LedgerTable rows={data.entries as LedgerRow[]} />
            )}
          </Card>
        </div>
      )}
    </>
  );
}
