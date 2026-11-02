import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { navFor } from '@/config/navigation';
import { Logo } from '@/components/ui/Logo';

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (!profile) return null;

  const items = navFor(profile.role);
  const displayName = profile.full_name || profile.email;
  const roleLabel = profile.role === 'admin' ? 'Administrator' : 'Agen';

  const navList = (
    <nav className="flex flex-col gap-1" aria-label="Menu utama">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/admin' || item.to === '/dashboard'}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`
          }
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  const userFooter = (
    <div className="space-y-3 border-t border-gray-100 pt-4">
      <div className="flex items-center gap-3 px-1">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{displayName}</p>
          <p className="truncate text-xs text-gray-500">{roleLabel}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
      >
        <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
        Keluar
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between border-r border-gray-200/80 bg-white p-5 lg:flex">
        <div className="space-y-8">
          <div className="px-1 pt-1">
            <Logo />
          </div>
          {navList}
        </div>
        {userFooter}
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200/80 bg-white/95 px-4 backdrop-blur lg:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="rounded-xl p-2 text-gray-600 hover:bg-gray-100"
          aria-label="Buka menu"
          aria-expanded={menuOpen}
        >
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="presentation">
          <div className="animate-fade-in absolute inset-0 bg-gray-900/40" onClick={() => setMenuOpen(false)} />
          <div className="animate-slide-up absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col justify-between bg-white p-5 shadow-xl">
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <Logo />
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                  aria-label="Tutup menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {navList}
            </div>
            {userFooter}
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
