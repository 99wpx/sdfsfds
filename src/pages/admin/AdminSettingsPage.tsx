import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { SettingRow } from '@/types/models';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { parseRupiahInput } from '@/lib/deposit-rules';

const SETTING_LABELS: Record<string, string> = {
  deposit_min_amount: 'Minimal deposit',
  deposit_max_amount: 'Maksimal deposit',
};

async function loadSettings(): Promise<SettingRow[]> {
  const { data, error } = await supabase.from('settings').select('key, value, description').order('key');
  if (error) throw new Error(error.message);
  return (data ?? []) as SettingRow[];
}

export function AdminSettingsPage() {
  const { data, error, loading, reload } = useAsyncData(loadSettings, []);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSaved = () => {
    setSuccessMessage('Pengaturan berhasil disimpan.');
    reload();
  };

  return (
    <>
      <PageHeader title="Pengaturan sistem" description="Batas dan parameter yang berlaku untuk seluruh agen." />

      {successMessage && (
        <div className="mb-6">
          <Alert tone="success">{successMessage}</Alert>
        </div>
      )}

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && data && data.length === 0 && (
        <EmptyState title="Belum ada pengaturan" description="Pengaturan sistem akan tampil di sini." />
      )}
      {!loading && !error && data && data.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((setting) => (
            <SettingCard key={setting.key} setting={setting} onSaved={handleSaved} />
          ))}
        </div>
      )}
    </>
  );
}

function SettingCard({ setting, onSaved }: { setting: SettingRow; onSaved: () => void }) {
  const isNumeric = typeof setting.value === 'number';
  const [draft, setDraft] = useState(isNumeric ? (setting.value as number).toLocaleString('id-ID') : String(setting.value ?? ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    let nextValue: number | string = draft.trim();
    if (isNumeric) {
      const parsed = parseRupiahInput(draft);
      if (!Number.isInteger(parsed) || parsed < 0) {
        setError('Masukkan angka bulat yang valid');
        return;
      }
      nextValue = parsed;
    }
    setSaving(true);
    const { error: saveError } = await supabase.from('settings').update({ value: nextValue }).eq('key', setting.key);
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    onSaved();
  };

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{SETTING_LABELS[setting.key] ?? setting.key}</h2>
          {setting.description && <p className="mt-1 text-sm text-gray-500">{setting.description}</p>}
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input label="Nilai" inputMode={isNumeric ? 'numeric' : 'text'} value={draft} onChange={(e) => setDraft(e.target.value)} />
          </div>
          <Button onClick={() => void handleSave()} loading={saving} disabled={draft.trim() === '' || draft === formatInitial(setting)}>
            Simpan
          </Button>
        </div>
      </div>
    </Card>
  );
}

function formatInitial(setting: SettingRow): string {
  return typeof setting.value === 'number' ? setting.value.toLocaleString('id-ID') : String(setting.value ?? '');
}
