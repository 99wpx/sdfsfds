import { useState, type ChangeEvent, type FormEvent } from 'react';
import { KeyRound, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, unwrap } from '@/lib/supabase';
import type { AgentProfile } from '@/types/models';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, SectionHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert, ErrorState, LoadingState } from '@/components/ui/States';
import { useAsyncData } from '@/hooks/useAsyncData';

async function loadAgentProfile(userId: string): Promise<AgentProfile> {
  const { data, error } = await supabase
    .from('agent_profiles')
    .select('user_id, business_name, city')
    .eq('user_id', userId)
    .maybeSingle();
  return unwrap<AgentProfile>({ data: data ?? null, error });
}

export function AgentProfilePage() {
  const { profile, authUser, refreshProfile } = useAuth();
  const userId = authUser?.id ?? '';
  const { data, error, loading, reload } = useAsyncData(() => loadAgentProfile(userId), [userId]);

  return (
    <>
      <PageHeader title="Profil & keamanan" description="Perbarui data usaha dan atur kata sandi akun Anda." />

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data && profile && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ProfileForm
            initial={{ fullName: profile.full_name, phone: profile.phone, businessName: data.business_name, city: data.city }}
            email={profile.email}
            userId={profile.id}
            onSaved={() => {
              void refreshProfile();
              reload();
            }}
          />
          <PasswordForm />
        </div>
      )}
    </>
  );
}

interface ProfileValues {
  fullName: string;
  phone: string;
  businessName: string;
  city: string;
}

function ProfileForm({
  initial,
  email,
  userId,
  onSaved,
}: {
  initial: ProfileValues;
  email: string;
  userId: string;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<ProfileValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const update = (field: keyof ProfileValues) => (e: ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    if (!values.fullName.trim()) {
      setError('Nama lengkap wajib diisi');
      return;
    }
    setSaving(true);
    const [userRes, agentRes] = await Promise.all([
      supabase.from('users').update({ full_name: values.fullName.trim(), phone: values.phone.trim() }).eq('id', userId),
      supabase.from('agent_profiles').update({ business_name: values.businessName.trim(), city: values.city.trim() }).eq('user_id', userId),
    ]);
    setSaving(false);
    const failure = userRes.error ?? agentRes.error;
    if (failure) {
      setError(failure.message);
      return;
    }
    setSuccess(true);
    onSaved();
  };

  return (
    <Card>
      <SectionHeader title="Data akun" description="Informasi ini tampil pada akun dan dokumen Anda." />
      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">Data akun berhasil disimpan.</Alert>}
        <Input label="Email" value={email} disabled readOnly hint="Email tidak dapat diubah" />
        <Input label="Nama lengkap" value={values.fullName} onChange={update('fullName')} />
        <Input label="Nomor HP" type="tel" value={values.phone} onChange={update('phone')} />
        <Input label="Nama usaha" value={values.businessName} onChange={update('businessName')} />
        <Input label="Kota" value={values.city} onChange={update('city')} />
        <div className="flex justify-end pt-2">
          <Button type="submit" loading={saving}>
            <UserRound className="h-4 w-4" aria-hidden="true" />
            Simpan perubahan
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    if (password.length < 8) {
      setError('Kata sandi baru minimal 8 karakter');
      return;
    }
    if (password !== confirm) {
      setError('Konfirmasi kata sandi tidak sama');
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPassword('');
    setConfirm('');
    setSuccess(true);
  };

  return (
    <Card>
      <SectionHeader title="Ganti kata sandi" description="Gunakan kata sandi yang kuat dan belum pernah dipakai di tempat lain." />
      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">Kata sandi berhasil diperbarui.</Alert>}
        <Input label="Kata sandi baru" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint="Minimal 8 karakter" />
        <Input label="Ulangi kata sandi baru" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <div className="flex justify-end pt-2">
          <Button type="submit" loading={saving} variant="secondary">
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Perbarui kata sandi
          </Button>
        </div>
      </form>
    </Card>
  );
}
