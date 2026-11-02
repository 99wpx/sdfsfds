import { Logo } from '@/components/ui/Logo';

export function ConfigUnavailable() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="max-w-sm space-y-4 text-center">
        <Logo />
        <p className="text-sm text-gray-500">Layanan AGENTPAY sedang tidak tersedia. Silakan coba lagi beberapa saat lagi.</p>
      </div>
    </div>
  );
}
