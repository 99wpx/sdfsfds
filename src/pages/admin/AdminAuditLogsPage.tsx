import { supabase } from '@/lib/supabase';
import { fetchUserSummaries } from '@/lib/admin-queries';
import { formatDateTime } from '@/lib/format';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { AuditLog } from '@/types/models';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';

interface AuditView extends AuditLog {
  actor_name: string;
}

async function loadAuditLogs(): Promise<AuditView[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, actor_id, action, entity, entity_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as AuditLog[];
  const actors = await fetchUserSummaries(rows.map((row) => row.actor_id).filter((id): id is string => Boolean(id)));
  return rows.map((row) => ({
    ...row,
    actor_name: row.actor_id ? (actors.get(row.actor_id)?.full_name ?? 'Pengguna tidak dikenal') : 'Sistem',
  }));
}

const columns: Column<AuditView>[] = [
  { header: 'Waktu', cell: (log) => <span className="whitespace-nowrap text-gray-600">{formatDateTime(log.created_at)}</span> },
  { header: 'Pelaku', cell: (log) => <span className="font-medium text-gray-900">{log.actor_name}</span> },
  { header: 'Aksi', cell: (log) => <span className="font-mono text-xs text-gray-700">{log.action}</span> },
  {
    header: 'Objek',
    cell: (log) => (
      <div className="min-w-[160px]">
        <p className="text-gray-900">{log.entity}</p>
        <p className="max-w-[220px] truncate font-mono text-xs text-gray-400">{log.entity_id}</p>
      </div>
    ),
  },
  {
    header: 'Detail',
    cell: (log) => <code className="block max-w-[320px] truncate text-xs text-gray-500">{JSON.stringify(log.metadata)}</code>,
  },
];

export function AdminAuditLogsPage() {
  const { data, error, loading, reload } = useAsyncData(loadAuditLogs, []);

  return (
    <>
      <PageHeader title="Log audit" description="Jejak seluruh tindakan penting di sistem. Catatan bersifat tetap." />

      <Card padding="none">
        {loading && <LoadingState />}
        {!loading && error && (
          <div className="p-5">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}
        {!loading && !error && data && data.length === 0 && <EmptyState title="Belum ada catatan audit" />}
        {!loading && !error && data && data.length > 0 && <DataTable columns={columns} rows={data} rowKey={(log) => log.id} />}
      </Card>
    </>
  );
}
