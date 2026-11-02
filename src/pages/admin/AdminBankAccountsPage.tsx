import { useState, type FormEvent } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { BankAccount } from '@/types/models';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/StatusBadge';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';

async function loadBankAccounts(): Promise<BankAccount[]> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('id, bank_name, account_number, account_holder, is_active, created_at')
    .order('bank_name');
  if (error) throw new Error(error.message);
  return (data ?? []) as BankAccount[];
}

interface BankFormValues {
  bank_name: string;
  account_number: string;
  account_holder: string;
  is_active: boolean;
}

const EMPTY_FORM: BankFormValues = { bank_name: '', account_number: '', account_holder: '', is_active: true };

export function AdminBankAccountsPage() {
  const { data, error, loading, reload } = useAsyncData(loadBankAccounts, []);
  const [editing, setEditing] = useState<BankAccount | 'new' | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSaved = (message: string) => {
    setEditing(null);
    setSuccessMessage(message);
    reload();
  };

  return (
    <>
      <PageHeader
        title="Rekening bank"
        description="Rekening tujuan yang ditampilkan kepada agen saat deposit."
        action={
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tambah rekening
          </Button>
        }
      />

      {successMessage && (
        <div className="mb-6">
          <Alert tone="success">{successMessage}</Alert>
        </div>
      )}

      <Card padding="none">
        {loading && <LoadingState />}
        {!loading && error && (
          <div className="p-5">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}
        {!loading && !error && data && data.length === 0 && (
          <EmptyState title="Belum ada rekening" description="Tambahkan rekening tujuan agar agen dapat melakukan deposit." />
        )}
        {!loading && !error && data && data.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {data.map((bank) => (
              <li key={bank.id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900">{bank.bank_name}</p>
                    <Badge tone={bank.is_active ? 'emerald' : 'gray'}>{bank.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
                  </div>
                  <p className="mt-0.5 font-mono text-sm text-gray-700">{bank.account_number}</p>
                  <p className="text-xs text-gray-500">
                    a.n. {bank.account_holder} · ditambahkan {formatDate(bank.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(bank)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Ubah
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && (
        <BankAccountModal
          bank={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}

function BankAccountModal({
  bank,
  onClose,
  onSaved,
}: {
  bank: BankAccount | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<BankFormValues>(
    bank
      ? { bank_name: bank.bank_name, account_number: bank.account_number, account_holder: bank.account_holder, is_active: bank.is_active }
      : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = <K extends keyof BankFormValues>(key: K, value: BankFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const payload = {
      bank_name: values.bank_name.trim(),
      account_number: values.account_number.replace(/\s+/g, ''),
      account_holder: values.account_holder.trim(),
      is_active: values.is_active,
    };
    if (!payload.bank_name || !payload.account_holder) {
      setError('Nama bank dan nama pemilik rekening wajib diisi');
      return;
    }
    if (!/^\d{5,30}$/.test(payload.account_number)) {
      setError('Nomor rekening harus berupa angka (5 sampai 30 digit)');
      return;
    }

    setSaving(true);
    const request = bank
      ? supabase.from('bank_accounts').update(payload).eq('id', bank.id)
      : supabase.from('bank_accounts').insert(payload);
    const { error: saveError } = await request;
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    onSaved(bank ? 'Rekening berhasil diperbarui.' : 'Rekening baru berhasil ditambahkan.');
  };

  return (
    <Modal open onClose={onClose} title={bank ? 'Ubah rekening' : 'Tambah rekening'} description="Rekening nonaktif tidak ditampilkan ke agen.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Input label="Nama bank" value={values.bank_name} onChange={(e) => setField('bank_name', e.target.value)} placeholder="Contoh: BCA" />
        <Input label="Nomor rekening" inputMode="numeric" value={values.account_number} onChange={(e) => setField('account_number', e.target.value)} />
        <Input label="Nama pemilik" value={values.account_holder} onChange={(e) => setField('account_holder', e.target.value)} />
        <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={values.is_active}
            onChange={(e) => setField('is_active', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          Tampilkan rekening ini untuk deposit agen
        </label>
        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button type="submit" loading={saving}>
            Simpan
          </Button>
        </div>
      </form>
    </Modal>
  );
}
