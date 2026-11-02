export type UserRole = 'admin' | 'agent';
export type AccountStatus = 'active' | 'suspended';
export type DepositStatus = 'pending' | 'approved' | 'rejected';
export type LedgerEntryType = 'deposit' | 'purchase' | 'refund' | 'adjustment';
export type TransactionStatus = 'pending' | 'success' | 'failed' | 'refunded';

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: UserRole;
  status: AccountStatus;
  created_at: string;
}

export interface AgentProfile {
  user_id: string;
  business_name: string;
  city: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
}

export interface LedgerEntry {
  id: string;
  user_id: string;
  entry_type: LedgerEntryType;
  amount: number;
  balance_after: number;
  reference_id: string;
  description: string;
  created_at: string;
}

export interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  is_active: boolean;
  created_at: string;
}

export interface Deposit {
  id: string;
  user_id: string;
  bank_account_id: string | null;
  amount: number;
  receipt_path: string;
  status: DepositStatus;
  admin_note: string;
  reviewed_at: string | null;
  created_at: string;
}

export interface AdminDepositRow extends Deposit {
  agent_name: string;
  agent_email: string;
}

export interface AdminAgentRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  status: AccountStatus;
  created_at: string;
  business_name: string;
  city: string;
  balance: number;
}

export interface AdminLedgerRow extends LedgerEntry {
  agent_name: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SettingRow {
  key: string;
  value: unknown;
  description: string;
}

export interface TransactionRow {
  id: string;
  reference_id: string;
  user_id: string;
  product_name: string;
  customer_no: string;
  selling_price: number;
  status: TransactionStatus;
  created_at: string;
}

export interface AdminTransactionRow extends TransactionRow {
  supplier_price: number;
  profit: number;
}

export interface AgentStats {
  balance: number;
  today_count: number;
  today_sales: number;
  today_profit: number;
  month_count: number;
  month_sales: number;
  month_profit: number;
  total_profit: number;
}

export interface ReportPoint {
  label: string;
  sales: number;
  profit: number;
  count: number;
}

export interface AdminStats {
  total_agents: number;
  active_agents: number;
  total_wallet_balance: number;
  approved_deposit_total: number;
  approved_deposit_count: number;
  pending_deposit_count: number;
  total_transactions: number;
  total_sales: number;
  total_gross_profit: number;
  daily: ReportPoint[];
  monthly: ReportPoint[];
}
