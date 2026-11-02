import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownToLine, Bell, CalendarDays, CheckCheck, ReceiptText, Wallet, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, unwrap } from '@/lib/supabase';
import { TRANSACTION_COLUMNS } from '@/lib/queries';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { AgentStats, AppNotification, TransactionRow } from '@/types/models';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Card, SectionHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { TransactionStatusBadge } from '@/components/ui/StatusBadge';

interface DashboardData {
  stats: AgentStats;
  transactions: TransactionRow[];
  notifications: AppNotification[];
}

async function loadDashboard(): Promise<DashboardData> {
  const [statsRes, txRes, notifRes] = await Promise.all([
    supabase.rpc('agent_dashboard_stats'),
    supabase.from('transactions').select(TRANSACTION_COLUMNS).order('created_at', { ascending: false }).limit(5),
    supabase.from('notifications').select('id, title, body, is_read, created_at').order('created_at', { ascending: false }).limit(5),
  ]);
  return {
    stats: unwrap<AgentStats>(statsRes),
    transactions: unwrap<TransactionRow[]>(txRes),
    notifications: unwrap<AppNotification[]>(notifRes),
  };
}

const quickLinks = [
  { to: '/deposit', label: 'Deposit saldo', description: 'Isi saldo via transfer bank', icon: ArrowDownToLine },
  { to: '/wallet', label: 'Mutasi saldo', description: 'Lihat riwayat masuk dan keluar', icon: Wallet },
  { to: '/transactions', label: 'Riwayat transaksi', description: 'Semua transaksi PPOB Anda', icon: ReceiptText },
];

export function AgentDashboardPage() {
  const { profile } = useAuth();
  const { data, error, loading, reload } = useAsyncData(loadDashboard, []);

  const [actionError, setActionError] = useState<string | null>(null);
  const unreadCount = useMemo(() => data?.notifications.filter((n) => !n.is_read).length ?? 0, [data]);

  const updateNotifications = async (query: PromiseLike<{ error: { message: string } | null }>) => {
    setActionError(null);
    const { error: updateError } = await query;
    if (updateError) {
      setActionError(updateError.message);
      return;
    }
    reload();
  };

  const markAllRead = () => updateNotifications(supabase.from('notifications').update({ is_read: true }).eq('is_read', false));
  const markRead = (id: string) => updateNotifications(supabase.from('notifications').update({ is_read: true }).eq('id', id));

  const firstName = profile?.full_name.split(' ')[0] || 'Agen';

  return (
    <>
      <PageHeader title={`Halo, ${firstName}`} description="Pantau saldo dan performa transaksi Anda hari ini." />

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Saldo tersedia"
              value={formatRupiah(data.stats.balance)}
              icon={<Wallet className="h-[18px] w-[18px]" />}
              hint="Saldo siap digunakan"
            />
            <StatCard
              label="Transaksi hari ini"
              value={String(data.stats.today_count)}
              icon={<CalendarDays className="h-[18px] w-[18px]" />}
              tone="sky"
              hint={`Penjualan ${formatRupiah(data.stats.today_sales)}`}
            />
            <StatCard
              label="Transaksi bulan ini"
              value={String(data.stats.month_count)}
              icon={<ReceiptText className="h-[18px] w-[18px]" />}
              tone="amber"
              hint={`Penjualan ${formatRupiah(data.stats.month_sales)}`}
            />
            <StatCard
              label="Total profit"
              value={formatRupiah(data.stats.total_profit)}
              icon={<TrendingUp className="h-[18px] w-[18px]" />}
              hint={`Bulan ini ${formatRupiah(data.stats.month_profit)}`}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {quickLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group flex items-center gap-4 rounded-2xl border border-gray-200/70 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{item.label}</p>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card padding="none" className="lg:col-span-2">
              <div className="flex items-center justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
                <SectionHeader title="Transaksi terbaru" />
                <Link to="/transactions" className="shrink-0 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                  Lihat semua
                </Link>
              </div>
              <div className="mt-4 divide-y divide-gray-100">
                {data.transactions.length === 0 ? (
                  <EmptyState title="Belum ada transaksi" description="Transaksi PPOB Anda akan tampil di sini." />
                ) : (
                  data.transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{tx.product_name}</p>
                        <p className="text-xs text-gray-500">
                          {tx.customer_no} · {formatDateTime(tx.created_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="text-sm font-semibold text-gray-900">{formatRupiah(tx.selling_price)}</span>
                        <TransactionStatusBadge status={tx.status} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card padding="none">
              <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  <h2 className="text-lg font-semibold text-gray-900">Notifikasi</h2>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">{unreadCount}</span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => void markAllRead()}>
                    <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Tandai dibaca
                  </Button>
                )}
              </div>
              <div className="mt-4 divide-y divide-gray-100">
                {data.notifications.length === 0 ? (
                  <EmptyState title="Belum ada notifikasi" />
                ) : (
                  <>
                    {actionError && <div className="px-5 pt-4 sm:px-6"><Alert tone="error">{actionError}</Alert></div>}
                    {data.notifications.map((note) => (
                    <button
                      type="button"
                      key={note.id}
                      onClick={() => !note.is_read && void markRead(note.id)}
                      className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50 sm:px-6"
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${note.is_read ? 'bg-gray-200' : 'bg-emerald-500'}`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className={`text-sm ${note.is_read ? 'font-medium text-gray-700' : 'font-semibold text-gray-900'}`}>{note.title}</p>
                        <p className="mt-0.5 text-sm text-gray-500">{note.body}</p>
                        <p className="mt-1 text-xs text-gray-400">{formatDateTime(note.created_at)}</p>
                      </div>
                    </button>
                    ))}
                  </>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
