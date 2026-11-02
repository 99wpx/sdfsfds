import type { ReactNode } from 'react';
import { Logo } from '@/components/ui/Logo';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-emerald-300/20 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <Logo light />
        </div>
        <div className="relative max-w-md space-y-6">
          <h2 className="text-4xl font-bold leading-[1.15] tracking-tight">Layani pelanggan lebih cepat, kelola saldo dengan aman.</h2>
          <p className="text-base leading-relaxed text-emerald-50/90">
            Satu dompet untuk pulsa, paket data, token PLN, dan berbagai layanan PPOB lainnya dengan harga yang ditetapkan admin.
          </p>
        </div>
        <p className="relative text-sm text-emerald-100/80">Platform PPOB untuk agen di seluruh Indonesia</p>
      </div>

      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
          {children}
          <div className="text-center text-sm text-gray-500">{footer}</div>
        </div>
      </div>
    </div>
  );
}
