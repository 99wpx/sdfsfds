import { useState } from 'react';
import { BadgeDollarSign, Banknote, CalendarDays, Clock, Landmark, ReceiptText, TrendingUp, Users, Wallet } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { formatRupiah } from '@/lib/format';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { AdminStats, ReportPoint } from '@/types/models';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Card, SectionHeader } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/States';

async function loadAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('admin_dashboard_stats');
  return unwrap<AdminStats>({ data: data as AdminStats | null, error });
}

type ReportView = 'daily' | 'monthly';

export function AdminDashboardPage() {
  const { data, error, loading, reload } = useAsyncData(loadAdminStats, []);

  return (
    <>
      <PageHeader title="Dashboard admin" description="Ringkasan agen, saldo, deposit, dan penjualan PPOB AGENTPAY." />

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total agen" value={data.total_agents.toLocaleString('id-ID')} icon={<Users className="h-[18px] w-[18px]" />} hint={`${data.active_agents.toLocaleString('id-ID')} agen aktif`} />
            <StatCard label="Total saldo dompet" value={formatRupiah(data.total_wallet_balance)} icon={<Wallet className="h-[18px] w-[18px]" />} tone="sky" hint="Seluruh saldo agen" />
            <StatCard
              label="Total deposit disetujui"
              value={formatRupiah(data.approved_deposit_total)}
              icon={<Landmark className="h-[18px] w-[18px]" />}
              tone="amber"
              hint={`${data.approved_deposit_count.toLocaleString('id-ID')} deposit · ${data.pending_deposit_count.toLocaleString('id-ID')} menunggu`}
            />
            <StatCard label="Total transaksi sukses" value={data.total_transactions.toLocaleString('id-ID')} icon={<ReceiptText className="h-[18px] w-[18px]" />} hint="Transaksi berstatus berhasil" />
            <StatCard label="Total penjualan" value={formatRupiah(data.total_sales)} icon={<BadgeDollarSign className="h-[18px] w-[18px]" />} hint="Nilai jual ke agen" />
            <StatCard label="Laba kotor" value={formatRupiah(data.total_gross_profit)} icon={<TrendingUp className="h-[18px] w-[18px]" />} hint="Selisih harga jual dan modal" />
            <StatCard label="Deposit menunggu" value={data.pending_deposit_count.toLocaleString('id-ID')} icon={<Clock className="h-[18px] w-[18px]" />} tone="amber" hint="Perlu verifikasi admin" />
            <StatCard label="Agen nonaktif" value={(data.total_agents - data.active_agents).toLocaleString('id-ID')} icon={<Banknote className="h-[18px] w-[18px]" />} tone="neutral" hint="Akun ditangguhkan" />
          </div>

          <ReportSection daily={data.daily} monthly={data.monthly} />
        </div>
      )}
    </>
  );
}

function ReportSection({ daily, monthly }: { daily: ReportPoint[]; monthly: ReportPoint[] }) {
  const [view, setView] = useState<ReportView>('daily');
  const points = view === 'daily' ? daily : monthly;
  const maxSales = Math.max(1, ...points.map((point) => point.sales));

  return (
    <Card>
      <SectionHeader
        title="Laporan penjualan"
        description={view === 'daily' ? '14 hari terakhir (WIB)' : '12 bulan terakhir (WIB)'}
        action={
          <div className="inline-flex rounded-lg bg-gray-100 p-1" role="tablist">
            {(['daily', 'monthly'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={view === option}
                onClick={() => setView(option)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  view === option ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {option === 'daily' ? 'Harian' : 'Bulanan'}
              </button>
            ))}
          </div>
        }
      />

      {points.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">Belum ada data penjualan.</p>
      ) : (
        <>
          <div className="mt-6 flex h-48 items-end gap-1.5 sm:gap-2">
            {points.map((point) => (
              <div key={point.label} className="group flex h-full flex-1 flex-col justify-end" title={`${point.label}: ${formatRupiah(point.sales)}`}>
                <div
                  className="w-full rounded-t-md bg-emerald-500/80 transition-all duration-300 group-hover:bg-emerald-600"
                  style={{ height: `${Math.max(2, (point.sales / maxSales) * 100)}%` }}
                />
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-1.5 text-[10px] text-gray-400 sm:gap-2">
            {points.map((point) => (
              <span key={point.label} className="flex-1 truncate text-center">
                {view === 'daily' ? point.label.slice(8) : point.label.slice(2)}
              </span>
            ))}
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="py-2.5 pr-4">Periode</th>
                  <th className="py-2.5 pr-4 text-right">Transaksi</th>
                  <th className="py-2.5 pr-4 text-right">Penjualan</th>
                  <th className="py-2.5 text-right">Laba kotor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...points].reverse().map((point) => (
                  <tr key={point.label}>
                    <td className="py-2.5 pr-4 font-medium text-gray-900">{point.label}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-600">{point.count.toLocaleString('id-ID')}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-900">{formatRupiah(point.sales)}</td>
                    <td className="py-2.5 text-right font-semibold text-emerald-700">{formatRupiah(point.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
