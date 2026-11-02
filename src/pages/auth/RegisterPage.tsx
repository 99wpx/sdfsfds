import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { homePathFor } from '@/config/navigation';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/States';

interface RegisterForm {
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  city: string;
  password: string;
  confirmPassword: string;
}

const emptyForm: RegisterForm = {
  fullName: '',
  businessName: '',
  email: '',
  phone: '',
  city: '',
  password: '',
  confirmPassword: '',
};

function validate(form: RegisterForm): string | null {
  if (!form.fullName.trim()) return 'Nama lengkap wajib diisi';
  if (!form.businessName.trim()) return 'Nama usaha wajib diisi';
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return 'Format email tidak valid';
  if (!/^\+?[0-9]{8,15}$/.test(form.phone.trim())) return 'Nomor HP tidak valid (8-15 digit)';
  if (!form.city.trim()) return 'Kota wajib diisi';
  if (form.password.length < 8) return 'Kata sandi minimal 8 karakter';
  if (form.password !== form.confirmPassword) return 'Konfirmasi kata sandi tidak sama';
  return null;
}

export function RegisterPage() {
  const { session, profile, signUp } = useAuth();
  const [form, setForm] = useState<RegisterForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  if (session && profile) {
    return <Navigate to={homePathFor(profile.role)} replace />;
  }

  const update = (field: keyof RegisterForm) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    try {
      const result = await signUp({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        businessName: form.businessName.trim(),
        city: form.city.trim(),
      });
      if (result.needsConfirmation) {
        setConfirmationSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pendaftaran gagal, silakan coba lagi');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmationSent) {
    return (
      <AuthLayout
        title="Pendaftaran berhasil"
        subtitle="Akun Anda sudah dibuat."
        footer={
          <Link to="/login" className="font-semibold text-emerald-700 hover:text-emerald-800">
            Kembali ke halaman masuk
          </Link>
        }
      >
        <Alert tone="success">Akun Anda sudah dibuat. Silakan masuk menggunakan email dan kata sandi yang baru Anda buat.</Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Daftar sebagai agen"
      subtitle="Isi data usaha Anda. Akun langsung aktif setelah pendaftaran."
      footer={
        <>
          Sudah punya akun?{' '}
          <Link to="/login" className="font-semibold text-emerald-700 hover:text-emerald-800">
            Masuk
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nama lengkap" autoComplete="name" value={form.fullName} onChange={update('fullName')} />
          <Input label="Nama usaha" value={form.businessName} onChange={update('businessName')} />
        </div>
        <Input label="Email" type="email" autoComplete="email" value={form.email} onChange={update('email')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nomor HP" type="tel" autoComplete="tel" value={form.phone} onChange={update('phone')} placeholder="08xxxxxxxxxx" />
          <Input label="Kota" value={form.city} onChange={update('city')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Kata sandi"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={update('password')}
            hint="Minimal 8 karakter"
          />
          <Input
            label="Ulangi kata sandi"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
          />
        </div>
        <Button type="submit" size="lg" loading={submitting} className="w-full">
          Buat akun
        </Button>
      </form>
    </AuthLayout>
  );
}
