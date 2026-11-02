import { useState } from 'react';
import { CheckCircle2, ExternalLink, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { AdminDepositRow } from '@/types/models';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert, ErrorState, LoadingState } from '@/components/ui/States';
import { DepositStatusBadge } from '@/components/ui/StatusBadge';

type Decision = 'approve' | 'reject';

const NOTE_MAX_LENGTH = 500;

async function loadReceiptUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('deposit-receipts').createSignedUrl(path, 600);
  if (error || !data?.signedUrl) {
    throw new Error('Bukti transfer tidak dapat dimuat');
  }
  return data.signedUrl;
}

export function DepositReviewModal({
  deposit,
  onClose,
  onReviewed,
}: {
  deposit: AdminDepositRow;
  onClose: () => void;
  onReviewed: () => void;
}) {
  const receipt = useAsyncData(() => loadReceiptUrl(deposit.receipt_path), [deposit.receipt_path]);
  const [note, setNote] = useState('');
  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = deposit.status === 'pending';
  const isPdf = deposit.receipt_path.toLowerCase().endsWith('.pdf');

  const confirmDecision = async () => {
    if (!pendingDecision) return;
    setError(null);
    if (pendingDecision === 'reject' && note.trim().length < 5) {
      setError('Isi alasan penolakan minimal 5 karakter agar agen dapat memperbaikinya');
      return;
    }
    setSubmitting(true);
    const { error: reviewError } = await supabase.rpc('review_deposit', {
      p_deposit_id: deposit.id,
      p_decision: pendingDecision,
      p_note: note.trim(),
    });
    setSubmitting(false);
    if (reviewError) {
      setError(reviewError.message);
      return;
    }
    onReviewed();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Verifikasi deposit"
      description={`${deposit.agent_name} · ${formatDateTime(deposit.created_at)}`}
    >
      <div className="space-y-6">
        {error && <Alert tone="error">{error}</Alert>}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-4 ring-1 ring-inset ring-gray-200/70">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Nominal transfer</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">{formatRupiah(deposit.amount)}</p>
            <p className="mt-1 text-xs text-gray-500">{deposit.agent_email}</p>
          </div>
          <DepositStatusBadge status={deposit.status} />
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">Bukti transfer</h3>
          {receipt.loading && <LoadingState label="Memuat bukti transfer..." />}
          {!receipt.loading && receipt.error && <ErrorState message={receipt.error} onRetry={receipt.reload} />}
          {!receipt.loading && !receipt.error && receipt.data &&
            (isPdf ? (
              <a
                href={receipt.data}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-emerald-700 ring-1 ring-gray-200 transition-colors hover:bg-emerald-50"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Buka bukti transfer (PDF)
              </a>
            ) : (
              <a href={receipt.data} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl ring-1 ring-gray-200">
                <img src={receipt.data} alt="Bukti transfer" className="max-h-96 w-full bg-gray-50 object-contain" />
              </a>
            ))}
        </section>

        {isPending ? (
          <section className="space-y-3">
            <label htmlFor="deposit-note" className="block text-sm font-medium text-gray-700">
              Catatan admin
            </label>
            <textarea
              id="deposit-note"
              rows={3}
              maxLength={NOTE_MAX_LENGTH}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Nominal sesuai, saldo ditambahkan"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15"
            />

            {pendingDecision === null ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="success" size="lg" onClick={() => setPendingDecision('approve')}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Setujui deposit
                </Button>
                <Button variant="danger" size="lg" onClick={() => setPendingDecision('reject')}>
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Tolak deposit
                </Button>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl bg-amber-50 p-4 ring-1 ring-inset ring-amber-600/20">
                <p className="text-sm text-amber-900">
                  {pendingDecision === 'approve'
                    ? `Saldo dompet ${deposit.agent_name} akan bertambah ${formatRupiah(deposit.amount)}. Tindakan ini tidak dapat dibatalkan.`
                    : 'Deposit akan ditolak dan agen dapat mengirim ulang bukti transfer.'}
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="secondary" onClick={() => setPendingDecision(null)} disabled={submitting}>
                    Batal
                  </Button>
                  <Button
                    variant={pendingDecision === 'approve' ? 'success' : 'danger'}
                    onClick={() => void confirmDecision()}
                    loading={submitting}
                  >
                    Ya, {pendingDecision === 'approve' ? 'setujui' : 'tolak'}
                  </Button>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-2 rounded-xl bg-gray-50 p-4 ring-1 ring-inset ring-gray-200/70">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Hasil verifikasi</p>
            <p className="text-sm text-gray-700">{deposit.admin_note || 'Tidak ada catatan admin.'}</p>
            {deposit.reviewed_at && <p className="text-xs text-gray-400">Diproses {formatDateTime(deposit.reviewed_at)}</p>}
          </section>
        )}
      </div>
    </Modal>
  );
}
