import { useState } from 'react';
import { Check, Copy, FileUp, Landmark } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatRupiah } from '@/lib/format';
import { parseRupiahInput, validateDepositAmount, validateReceiptFile, RECEIPT_MIME_TYPES } from '@/lib/deposit-rules';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { BankAccount } from '@/types/models';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert, ErrorState, LoadingState } from '@/components/ui/States';

interface DepositOptions {
  limits: { min: number; max: number };
  bankAccounts: BankAccount[];
}

const QUICK_AMOUNTS = [100_000, 500_000, 1_000_000, 5_000_000];

const RECEIPT_EXTENSIONS: Record<(typeof RECEIPT_MIME_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

async function loadDepositOptions(): Promise<DepositOptions> {
  const [settingsRes, banksRes] = await Promise.all([
    supabase.from('settings').select('key, value').in('key', ['deposit_min_amount', 'deposit_max_amount']),
    supabase.from('bank_accounts').select('id, bank_name, account_number, account_holder, is_active, created_at').eq('is_active', true).order('bank_name'),
  ]);
  if (settingsRes.error) throw new Error(settingsRes.error.message);
  if (banksRes.error) throw new Error(banksRes.error.message);

  const settings = new Map((settingsRes.data ?? []).map((row) => [row.key as string, Number(row.value)]));
  const min = settings.get('deposit_min_amount');
  const max = settings.get('deposit_max_amount');
  if (min === undefined || max === undefined || Number.isNaN(min) || Number.isNaN(max)) {
    throw new Error('Batas deposit belum diatur oleh admin');
  }

  return { limits: { min, max }, bankAccounts: (banksRes.data ?? []) as BankAccount[] };
}

export function NewDepositModal({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const { data, error, loading, reload } = useAsyncData(loadDepositOptions, []);

  return (
    <Modal open onClose={onClose} title="Deposit saldo" description="Transfer ke rekening tujuan, lalu unggah bukti transfer.">
      {loading && <LoadingState label="Menyiapkan form deposit..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && data && (
        <DepositForm options={data} onClose={onClose} onSubmitted={onSubmitted} />
      )}
    </Modal>
  );
}

function DepositForm({ options, onClose, onSubmitted }: { options: DepositOptions; onClose: () => void; onSubmitted: () => void }) {
  const { authUser } = useAuth();
  const [amountInput, setAmountInput] = useState('');
  const [bankId, setBankId] = useState<string | null>(options.bankAccounts[0]?.id ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const amount = parseRupiahInput(amountInput);
  const selectedBank = options.bankAccounts.find((bank) => bank.id === bankId) ?? null;

  const handleAmountChange = (raw: string) => {
    const parsed = parseRupiahInput(raw);
    setAmountInput(Number.isNaN(parsed) ? '' : parsed.toLocaleString('id-ID'));
  };

  const handleFileChange = (selected: File | undefined) => {
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    const fileError = validateReceiptFile(selected);
    if (fileError) {
      setFile(null);
      setError(fileError);
      return;
    }
    setFile(selected);
  };

  const copyAccountNumber = async () => {
    if (!selectedBank) return;
    await navigator.clipboard.writeText(selectedBank.account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!authUser) {
      setError('Sesi Anda berakhir, silakan masuk kembali');
      return;
    }
    const amountError = validateDepositAmount(amount, options.limits);
    if (amountError) {
      setError(amountError);
      return;
    }
    if (!selectedBank) {
      setError('Pilih rekening tujuan transfer');
      return;
    }
    if (!file) {
      setError('Unggah bukti transfer terlebih dahulu');
      return;
    }

    setSubmitting(true);
    try {
      const path = `${authUser.id}/${crypto.randomUUID()}.${RECEIPT_EXTENSIONS[file.type as keyof typeof RECEIPT_EXTENSIONS]}`;
      const { error: uploadError } = await supabase.storage
        .from('deposit-receipts')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        throw new Error('Gagal mengunggah bukti transfer, silakan coba lagi');
      }

      const { error: submitError } = await supabase.rpc('submit_deposit', {
        p_amount: amount,
        p_bank_account_id: selectedBank.id,
        p_receipt_path: path,
      });
      if (submitError) {
        throw new Error(submitError.message);
      }

      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deposit gagal dikirim, silakan coba lagi');
    } finally {
      setSubmitting(false);
    }
  };

  if (options.bankAccounts.length === 0) {
    return (
      <div className="space-y-4">
        <Alert tone="info">Belum ada rekening tujuan yang aktif. Silakan hubungi admin AGENTPAY.</Alert>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {error && <Alert tone="error">{error}</Alert>}

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">1</span>
          Nominal deposit
        </div>
        <Input
          label="Jumlah (Rupiah)"
          inputMode="numeric"
          value={amountInput}
          onChange={(e) => handleAmountChange(e.target.value)}
          placeholder="Contoh: 500.000"
          hint={`Minimal ${formatRupiah(options.limits.min)} · Maksimal ${formatRupiah(options.limits.max)}`}
        />
        <div className="flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmountInput(value.toLocaleString('id-ID'))}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                amount === value ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-gray-600 ring-gray-200 hover:ring-emerald-300'
              }`}
            >
              {formatRupiah(value)}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">2</span>
          Rekening tujuan
        </div>
        <div className="grid gap-2">
          {options.bankAccounts.map((bank) => (
            <button
              key={bank.id}
              type="button"
              onClick={() => setBankId(bank.id)}
              className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${
                bankId === bank.id ? 'border-emerald-500 bg-emerald-50/60 ring-4 ring-emerald-500/10' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-gray-600 ring-1 ring-gray-200">
                <Landmark className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{bank.bank_name}</p>
                <p className="truncate text-xs text-gray-500">
                  {bank.account_number} · a.n. {bank.account_holder}
                </p>
              </div>
            </button>
          ))}
        </div>
        {selectedBank && amount > 0 && (
          <div className="rounded-xl bg-gray-50 p-4 ring-1 ring-inset ring-gray-200/70">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Instruksi transfer</p>
            <p className="mt-2 text-sm text-gray-700">
              Transfer tepat <span className="font-semibold text-gray-900">{formatRupiah(amount)}</span> ke nomor rekening di bawah ini.
            </p>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2.5 ring-1 ring-gray-200">
              <span className="font-mono text-sm font-semibold tracking-wide text-gray-900">{selectedBank.account_number}</span>
              <button
                type="button"
                onClick={() => void copyAccountNumber()}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Tersalin' : 'Salin'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">3</span>
          Bukti transfer
        </div>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/60 px-4 py-6 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50/40">
          <FileUp className="h-6 w-6 text-emerald-600" aria-hidden="true" />
          <span className="text-sm font-medium text-gray-700">{file ? file.name : 'Pilih foto atau PDF bukti transfer'}</span>
          <span className="text-xs text-gray-500">JPG, PNG, WEBP, atau PDF · maksimal 5 MB</span>
          <input
            type="file"
            accept={RECEIPT_MIME_TYPES.join(',')}
            className="sr-only"
            onChange={(e) => handleFileChange(e.target.files?.[0])}
          />
        </label>
      </section>

      <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Batal
        </Button>
        <Button onClick={() => void handleSubmit()} loading={submitting}>
          Kirim deposit
        </Button>
      </div>
    </div>
  );
}
