/*
# AGENTPAY core tables and access rules

Creates the foundation tables for the PPOB agent platform: users, agent profiles,
wallets and their immutable ledger, bank accounts, manual deposits, product catalog
(categories, products, prices), PPOB transactions and their logs, supplier callback
records, notifications, settings and audit logs.

## 1. New tables
- users: one row per sign-in account, with role (admin or agent) and status (active or suspended).
- agent_profiles: business name and city for each agent.
- wallets: one IDR balance per agent. Balance can never go below zero.
- wallet_ledger: append-only list of every balance change, with a unique reference per entry.
- bank_accounts: company bank accounts shown to agents for manual transfers.
- deposits: manual deposit requests with receipt path and pending/approved/rejected status.
- product_categories, products, product_prices: PPOB catalog. Admin controls selling prices.
- transactions: PPOB purchases with selling price, supplier price and profit.
- transaction_logs: append-only event history for each transaction.
- supplier_callbacks: received supplier callbacks, unique per idempotency key.
- notifications: in-app messages per user.
- settings: key/value configuration managed by admin.
- audit_logs: append-only record of sensitive actions.

## 2. Security
- Row level security is enabled on every table.
- All default grants to anon and authenticated are removed, then only needed verbs are granted back.
- Agents can only read their own rows. Admins are identified through is_admin().
- Agents can edit only their name, phone, business name, city and notification read flag.
- Balances, roles, statuses, prices and deposit decisions cannot be changed directly by clients.
- Supplier cost and profit columns are not readable by agents. Admin reads them through server functions.
- Ledger, transaction logs and audit logs reject UPDATE and DELETE.

## 3. Important notes
1. Wallet and deposit writes are added in the next migration through server-side functions.
2. Tables for supplier callbacks are read-only for admins and will be written by the supplier integration later.
*/

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only and cannot be changed or deleted', TG_TABLE_NAME USING ERRCODE = '42501';
END;
$$;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_role_status_idx ON public.users (role, status);

CREATE TABLE IF NOT EXISTS public.agent_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  business_name text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency text NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id),
  user_id uuid NOT NULL REFERENCES public.users(id),
  entry_type text NOT NULL CHECK (entry_type IN ('deposit', 'purchase', 'refund', 'adjustment')),
  amount bigint NOT NULL CHECK (amount <> 0),
  balance_after bigint NOT NULL CHECK (balance_after >= 0),
  reference_id text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_ledger_user_created_idx ON public.wallet_ledger (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_holder text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  bank_account_id uuid REFERENCES public.bank_accounts(id),
  amount bigint NOT NULL CHECK (amount > 0),
  receipt_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text NOT NULL DEFAULT '',
  reviewed_by uuid REFERENCES public.users(id),
  reviewed_at timestamptz,
  ledger_reference text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'pending' OR reviewed_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS deposits_status_created_idx ON public.deposits (status, created_at DESC);
CREATE INDEX IF NOT EXISTS deposits_user_created_idx ON public.deposits (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.product_categories(id),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  provider text NOT NULL DEFAULT 'digiflazz',
  supplier_sku text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products (category_id);

CREATE TABLE IF NOT EXISTS public.product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  selling_price bigint NOT NULL CHECK (selling_price >= 0),
  supplier_price bigint NOT NULL CHECK (supplier_price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_prices_product_idx ON public.product_prices (product_id, effective_from DESC);

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  customer_no text NOT NULL,
  product_name text NOT NULL,
  selling_price bigint NOT NULL CHECK (selling_price >= 0),
  supplier_price bigint NOT NULL CHECK (supplier_price >= 0),
  profit bigint GENERATED ALWAYS AS (selling_price - supplier_price) STORED,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
  supplier_ref text NOT NULL DEFAULT '',
  failure_reason text NOT NULL DEFAULT '',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transactions_user_created_idx ON public.transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_status_created_idx ON public.transactions (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.transaction_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transaction_logs_transaction_idx ON public.transaction_logs (transaction_id, created_at);

CREATE TABLE IF NOT EXISTS public.supplier_callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'digiflazz',
  idempotency_key text NOT NULL UNIQUE,
  ref_id text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs (created_at DESC);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin' AND u.status = 'active'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP TRIGGER IF EXISTS users_touch_updated_at ON public.users;
CREATE TRIGGER users_touch_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS agent_profiles_touch_updated_at ON public.agent_profiles;
CREATE TRIGGER agent_profiles_touch_updated_at BEFORE UPDATE ON public.agent_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS wallets_touch_updated_at ON public.wallets;
CREATE TRIGGER wallets_touch_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS deposits_touch_updated_at ON public.deposits;
CREATE TRIGGER deposits_touch_updated_at BEFORE UPDATE ON public.deposits FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS products_touch_updated_at ON public.products;
CREATE TRIGGER products_touch_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS transactions_touch_updated_at ON public.transactions;
CREATE TRIGGER transactions_touch_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS settings_touch_updated_at ON public.settings;
CREATE TRIGGER settings_touch_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS wallet_ledger_append_only ON public.wallet_ledger;
CREATE TRIGGER wallet_ledger_append_only BEFORE UPDATE OR DELETE ON public.wallet_ledger FOR EACH ROW EXECUTE FUNCTION public.reject_mutation();
DROP TRIGGER IF EXISTS audit_logs_append_only ON public.audit_logs;
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.reject_mutation();
DROP TRIGGER IF EXISTS transaction_logs_append_only ON public.transaction_logs;
CREATE TRIGGER transaction_logs_append_only BEFORE UPDATE OR DELETE ON public.transaction_logs FOR EACH ROW EXECUTE FUNCTION public.reject_mutation();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.users, public.agent_profiles, public.wallets, public.wallet_ledger,
  public.bank_accounts, public.deposits, public.product_categories, public.products,
  public.product_prices, public.transactions, public.transaction_logs, public.supplier_callbacks,
  public.notifications, public.settings, public.audit_logs FROM anon, authenticated;

-- users: profile reads and name/phone edits only. Role and status are changed by admin functions.
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (full_name, phone) ON public.users TO authenticated;

DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());
DROP POLICY IF EXISTS "users_select_admin" ON public.users;
CREATE POLICY "users_select_admin" ON public.users FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- agent_profiles
GRANT SELECT ON public.agent_profiles TO authenticated;
GRANT UPDATE (business_name, city) ON public.agent_profiles TO authenticated;

DROP POLICY IF EXISTS "agent_profiles_select_own" ON public.agent_profiles;
CREATE POLICY "agent_profiles_select_own" ON public.agent_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "agent_profiles_select_admin" ON public.agent_profiles;
CREATE POLICY "agent_profiles_select_admin" ON public.agent_profiles FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS "agent_profiles_update_own" ON public.agent_profiles;
CREATE POLICY "agent_profiles_update_own" ON public.agent_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- wallets and ledger: read only for clients. Writes happen only in server functions.
GRANT SELECT ON public.wallets, public.wallet_ledger TO authenticated;

DROP POLICY IF EXISTS "wallets_select_own" ON public.wallets;
CREATE POLICY "wallets_select_own" ON public.wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "wallets_select_admin" ON public.wallets;
CREATE POLICY "wallets_select_admin" ON public.wallets FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "wallet_ledger_select_own" ON public.wallet_ledger;
CREATE POLICY "wallet_ledger_select_own" ON public.wallet_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "wallet_ledger_select_admin" ON public.wallet_ledger;
CREATE POLICY "wallet_ledger_select_admin" ON public.wallet_ledger FOR SELECT TO authenticated
  USING (public.is_admin());

-- bank accounts: agents see active accounts, admin manages them
GRANT SELECT, INSERT, UPDATE ON public.bank_accounts TO authenticated;

DROP POLICY IF EXISTS "bank_accounts_select" ON public.bank_accounts;
CREATE POLICY "bank_accounts_select" ON public.bank_accounts FOR SELECT TO authenticated
  USING (is_active OR public.is_admin());
DROP POLICY IF EXISTS "bank_accounts_insert_admin" ON public.bank_accounts;
CREATE POLICY "bank_accounts_insert_admin" ON public.bank_accounts FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "bank_accounts_update_admin" ON public.bank_accounts;
CREATE POLICY "bank_accounts_update_admin" ON public.bank_accounts FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- deposits: agents read their own; creation and review happen in server functions
GRANT SELECT ON public.deposits TO authenticated;

DROP POLICY IF EXISTS "deposits_select_own" ON public.deposits;
CREATE POLICY "deposits_select_own" ON public.deposits FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "deposits_select_admin" ON public.deposits;
CREATE POLICY "deposits_select_admin" ON public.deposits FOR SELECT TO authenticated
  USING (public.is_admin());

-- product catalog: agents see active items, admin manages them
GRANT SELECT, INSERT, UPDATE ON public.product_categories, public.products TO authenticated;
GRANT SELECT (id, product_id, selling_price, is_active, effective_from, created_at) ON public.product_prices TO authenticated;
GRANT INSERT, UPDATE ON public.product_prices TO authenticated;

DROP POLICY IF EXISTS "product_categories_select" ON public.product_categories;
CREATE POLICY "product_categories_select" ON public.product_categories FOR SELECT TO authenticated
  USING (is_active OR public.is_admin());
DROP POLICY IF EXISTS "product_categories_insert_admin" ON public.product_categories;
CREATE POLICY "product_categories_insert_admin" ON public.product_categories FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "product_categories_update_admin" ON public.product_categories;
CREATE POLICY "product_categories_update_admin" ON public.product_categories FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select" ON public.products FOR SELECT TO authenticated
  USING (is_active OR public.is_admin());
DROP POLICY IF EXISTS "products_insert_admin" ON public.products;
CREATE POLICY "products_insert_admin" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "products_update_admin" ON public.products;
CREATE POLICY "products_update_admin" ON public.products FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_prices_select" ON public.product_prices;
CREATE POLICY "product_prices_select" ON public.product_prices FOR SELECT TO authenticated
  USING (is_active OR public.is_admin());
DROP POLICY IF EXISTS "product_prices_insert_admin" ON public.product_prices;
CREATE POLICY "product_prices_insert_admin" ON public.product_prices FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "product_prices_update_admin" ON public.product_prices;
CREATE POLICY "product_prices_update_admin" ON public.product_prices FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- transactions: agents see own rows without supplier cost or profit columns
GRANT SELECT (id, reference_id, user_id, product_id, customer_no, product_name, selling_price,
  status, supplier_ref, failure_reason, completed_at, created_at, updated_at)
  ON public.transactions TO authenticated;

DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- admin-only monitoring tables
GRANT SELECT ON public.transaction_logs, public.supplier_callbacks, public.audit_logs TO authenticated;

DROP POLICY IF EXISTS "transaction_logs_select_admin" ON public.transaction_logs;
CREATE POLICY "transaction_logs_select_admin" ON public.transaction_logs FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS "supplier_callbacks_select_admin" ON public.supplier_callbacks;
CREATE POLICY "supplier_callbacks_select_admin" ON public.supplier_callbacks FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin());

-- notifications: users read and mark their own as read
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- settings: non-sensitive configuration readable by signed-in users, written by admin only
GRANT SELECT, INSERT, UPDATE ON public.settings TO authenticated;

DROP POLICY IF EXISTS "settings_select" ON public.settings;
CREATE POLICY "settings_select" ON public.settings FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "settings_insert_admin" ON public.settings;
CREATE POLICY "settings_insert_admin" ON public.settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "settings_update_admin" ON public.settings;
CREATE POLICY "settings_update_admin" ON public.settings FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
