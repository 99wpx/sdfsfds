import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 p-6 text-center">
      <Logo />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-emerald-700">Error 404</p>
        <h1 className="text-2xl font-bold text-gray-900">Halaman tidak ditemukan</h1>
        <p className="text-sm text-gray-500">Halaman yang Anda cari tidak tersedia atau sudah dipindahkan.</p>
      </div>
      <Link to="/">
        <Button>Kembali ke beranda</Button>
      </Link>
    </div>
  );
}
