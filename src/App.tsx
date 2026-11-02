import { Route, Routes } from 'react-router-dom';
import { isSupabaseConfigured } from '@/lib/supabase';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { RequireRole } from '@/components/layout/RequireRole';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { AgentDashboardPage } from '@/pages/agent/AgentDashboardPage';
import { AgentDepositsPage } from '@/pages/agent/AgentDepositsPage';
import { AgentWalletPage } from '@/pages/agent/AgentWalletPage';
import { AgentTransactionsPage } from '@/pages/agent/AgentTransactionsPage';
import { AgentProfilePage } from '@/pages/agent/AgentProfilePage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminDepositsPage } from '@/pages/admin/AdminDepositsPage';
import { AdminAgentsPage } from '@/pages/admin/AdminAgentsPage';
import { AdminLedgerPage } from '@/pages/admin/AdminLedgerPage';
import { AdminTransactionsPage } from '@/pages/admin/AdminTransactionsPage';
import { AdminBankAccountsPage } from '@/pages/admin/AdminBankAccountsPage';
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage';
import { AdminAuditLogsPage } from '@/pages/admin/AdminAuditLogsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ConfigUnavailable } from '@/components/layout/ConfigUnavailable';
import { HomeRedirect } from '@/components/layout/HomeRedirect';

export default function App() {
  if (!isSupabaseConfigured) {
    return <ConfigUnavailable />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomeRedirect />} />

        <Route element={<RequireRole role="agent" />}>
          <Route path="/dashboard" element={<AgentDashboardPage />} />
          <Route path="/deposit" element={<AgentDepositsPage />} />
          <Route path="/wallet" element={<AgentWalletPage />} />
          <Route path="/transactions" element={<AgentTransactionsPage />} />
          <Route path="/profile" element={<AgentProfilePage />} />
        </Route>

        <Route element={<RequireRole role="admin" />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/deposits" element={<AdminDepositsPage />} />
          <Route path="/admin/agents" element={<AdminAgentsPage />} />
          <Route path="/admin/ledger" element={<AdminLedgerPage />} />
          <Route path="/admin/transactions" element={<AdminTransactionsPage />} />
          <Route path="/admin/bank-accounts" element={<AdminBankAccountsPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
          <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
