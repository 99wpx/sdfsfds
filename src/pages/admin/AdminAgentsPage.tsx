import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Power } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate, formatRupiah } from '@/lib/format';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { AccountStatus, AdminAgentRow } from '@/types/models';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { AccountStatusBadge } from '@/components/ui/StatusBadge';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { AgentStatusModal, WalletAdjustmentModal } from '@/components/admin/AgentActionModals';

interface AgentRecord {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  status: AccountStatus;
  created_at: string;
}

async function loadAgents(): Promise<AdminAgentRow[]> {
  const [usersRes, profilesRes, walletsRes] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, email, phone, status, created_at')
      .eq('role', 'agent')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('agent_profiles').select('user_id, business_name, city'),
    supabase.from('wallets').select('user_id, balance'),
  ]);
  if (usersRes.error) throw new Error(usersRes.error.message);
  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (walletsRes.error) throw new Error(walletsRes.error.message);

  const profiles = new Map((profilesRes.data ?? []).map((row) => [row.user_id as string, row]));
  const wallets = new Map((walletsRes.data ?? []).map((row) => [row.user_id as string, Number(row.balance)]));

  return ((usersRes.data ?? []) as AgentRecord[]).map((agent) => ({
    ...agent,
    business_name: (profiles.get(agent.id)?.business_name as string | undefined) ?? '-',
    city: (profiles.get(agent.id)?.city as string | undefined) ?? '-',
    balance: wallets.get(agent.id) ?? 0,
  }));
}

type ActiveAction = { kind: 'adjust' | 'status'; agent: AdminAgentRow } | null;

export function AdminAgentsPage() {
  const { data, error, loading, reload } = useAsyncData(loadAgents, []);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState<ActiveAction>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!data) return [];
    if (!term) return data;
    return data.filter((agent) =>
      [agent.full_name, agent.email, agent.business_name, agent.city].some((value) => value.toLowerCase().includes(term)),
    );
  }, [data, query]);

  const handleDone = (message: string) => {
    setAction(null);
    setSuccessMessage(message);
    reload();
  };

  const columns: Column<AdminAgentRow>[] = [
    {
      header: 'Agen',
      cell: (agent) => (
        <div className="min-w-[180px]">
          <p className="font-medium text-gray-900">{agent.full_name}</p>
          <p className="text-xs text-gray-500">{agent.email}</p>
        </div>
      ),
    },
    {
      header: 'Usaha',
      cell: (agent) => (
        <div>
          <p className="text-gray-900">{agent.business_name}</p>
          <p className="text-xs text-gray-500">{agent.city}</p>
        </div>
      ),
    },
    { header: 'Saldo', align: 'right', cell: (agent) => <span className="whitespace-nowrap font-semibold text-gray-900">{formatRupiah(agent.balance)}</span> },
    { header: 'Status', cell: (agent) => <AccountStatusBadge status={agent.status} /> },
    { header: 'Bergabung', cell: (agent) => <span className="whitespace-nowrap text-gray-600">{formatDate(agent.created_at)}</span> },
    {
      header: 'Aksi',
      align: 'right',
      cell: (agent) => (
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setAction({ kind: 'adjust', agent })}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            Saldo
          </button>
          <button
            type="button"
            onClick={() => setAction({ kind: 'status', agent })}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              agent.status === 'active' ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <Power className="h-3.5 w-3.5" aria-hidden="true" />
            {agent.status === 'active' ? 'Tangguhkan' : 'Aktifkan'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Kelola agen" description="Pantau akun agen, saldo dompet, dan status akses." />

      {successMessage && (
        <div className="mb-6">
          <Alert tone="success">{successMessage}</Alert>
        </div>
      )}

      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h2 className="text-base font-semibold text-gray-900">Daftar agen</h2>
          <div className="w-full sm:w-72">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                aria-label="Cari agen"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama, email, usaha, atau kota"
                className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15"
              />
            </div>
          </div>
        </div>

        {loading && <LoadingState />}
        {!loading && error && (
          <div className="p-5">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}
        {!loading && !error && data && filtered.length === 0 && (
          <EmptyState title={data.length === 0 ? 'Belum ada agen' : 'Agen tidak ditemukan'} description={data.length === 0 ? 'Agen yang mendaftar akan tampil di sini.' : 'Coba kata kunci lain.'} />
        )}
        {!loading && !error && filtered.length > 0 && <DataTable columns={columns} rows={filtered} rowKey={(agent) => agent.id} />}
      </Card>

      {action?.kind === 'adjust' && <WalletAdjustmentModal agent={action.agent} onClose={() => setAction(null)} onDone={handleDone} />}
      {action?.kind === 'status' && <AgentStatusModal agent={action.agent} onClose={() => setAction(null)} onDone={handleDone} />}
    </>
  );
}
