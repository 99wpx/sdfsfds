import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatRupiah } from '@/lib/format';
import type { AccountStatus } from '@/types/models';
import type { AdminAgentRow } from '@/types/models';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/States';
import { parseRupiahInput } from '@/lib/deposit-rules';

const MAX_ADJUSTMENT = 1_000_000_000_000;

export function WalletAdjustmentModal({ agent, onClose, onDone }: { agent: AdminAgentRow; onClose: () => void; onDone: (message: string) => void }) {
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [amountInput, setAmountInput] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = parseRupiahInput(amountInput);

  const handleSubmit = async () => {
    setError(null);
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_ADJUSTMENT) {
      setError('Masukkan nominal penyesuaian yang valid');
      return;
    }
    if (note.trim().length < 5) {
      setError('Catatan penyesuaian wajib diisi (minimal 5 karakter)');
      return;
    }
    const signed = direction === 'credit' ? amount : -amount;
    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc('admin_wallet_adjustment', {
      p_user_id: agent.id,
      p_amount: signed,
      p_note: note.trim(),
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onDone(`Saldo ${agent.full_name} berhasil ${direction === 'credit' ? 'ditambah' : 'dikurangi'} ${formatRupiah(amount)}.`);
  };

  return (
    <Modal open onClose={onClose} title="Penyesuaian saldo" description={`${agent.full_name} · saldo saat ini ${formatRupiah(agent.balance)}`}>
      <div className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Jenis penyesuaian">
          {(
            [
              { value: 'credit', label: 'Tambah saldo' },
              { value: 'debit', label: 'Kurangi saldo' },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={direction === option.value}
              onClick={() => setDirection(option.value)}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                direction === option.value
                  ? option.value === 'credit'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-4 ring-emerald-500/10'
                    : 'border-rose-500 bg-rose-50 text-rose-700 ring-4 ring-rose-500/10'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Input
          label="Nominal (Rupiah)"
          inputMode="numeric"
          value={amountInput}
          onChange={(e) => {
            const parsed = parseRupiahInput(e.target.value);
            setAmountInput(Number.isNaN(parsed) || parsed === 0 ? '' : parsed.toLocaleString('id-ID'));
          }}
          placeholder="Contoh: 100.000"
        />

        <div className="space-y-1.5">
          <label htmlFor="adjustment-note" className="block text-sm font-medium text-gray-700">
            Catatan (wajib)
          </label>
          <textarea
            id="adjustment-note"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Alasan penyesuaian saldo"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15"
          />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button variant={direction === 'credit' ? 'success' : 'danger'} onClick={() => void handleSubmit()} loading={submitting}>
            Simpan penyesuaian
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function AgentStatusModal({
  agent,
  onClose,
  onDone,
}: {
  agent: AdminAgentRow;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const nextStatus: AccountStatus = agent.status === 'active' ? 'suspended' : 'active';
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc('admin_set_agent_status', { p_user_id: agent.id, p_status: nextStatus });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onDone(nextStatus === 'active' ? `${agent.full_name} kembali aktif.` : `${agent.full_name} berhasil ditangguhkan.`);
  };

  const suspending = nextStatus === 'suspended';

  return (
    <Modal
      open
      onClose={onClose}
      title={suspending ? 'Tangguhkan agen' : 'Aktifkan agen'}
      description={agent.full_name}
    >
      <div className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}
        <p className="text-sm text-gray-600">
          {suspending
            ? 'Agen tidak dapat masuk ke AGENTPAY dan transaksi baru tidak dapat dilakukan sampai akun diaktifkan kembali.'
            : 'Agen dapat kembali masuk dan melakukan transaksi seperti biasa.'}
        </p>
        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button variant={suspending ? 'danger' : 'success'} onClick={() => void handleConfirm()} loading={submitting}>
            {suspending ? 'Ya, tangguhkan' : 'Ya, aktifkan'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
