/*
# Wallet posting, deposits, admin actions and sign-up hook

Adds the only code paths that can change money or account state. Clients call
these functions through the database API; they cannot change balances directly.

## 1. New functions
- apply_wallet_entry: posts one immutable ledger entry and updates the wallet balance in one step.
  Duplicate references are rejected or treated as already applied, so a retry cannot double-credit.
- submit_deposit: an active agent submits a deposit with amount, bank account and uploaded receipt.
- review_deposit: admin approves (credits the wallet once) or rejects a pending deposit.
- admin_wallet_adjustment: admin credits or debits an agent wallet with a required note.
- admin_set_agent_status: admin activates or suspends an agent.
- agent_dashboard_stats: totals for the signed-in agent (balance, today, month, profit).
- admin_dashboard_stats: platform totals plus last 14 days and last 12 months of sales.
- admin_list_transactions: admin-only transaction list including supplier cost and profit.
- handle_new_auth_user: when someone signs up, creates their user, agent profile, and wallet with role agent.

## 2. Security changes
- Every function sets a fixed search path.
- Internal posting function is not callable by clients.
- Sign-up trigger cannot be called by clients and always creates agents, never admins.
- Admin functions check the caller is an active admin before doing anything.
- Each sensitive action writes a row to the audit log.

## 3. Important notes
1. Deposit approval uses a row lock so a deposit can be approved only once.
2. Balances can never go below zero. Ledger rows cannot be edited or deleted.
3. Deposit amount limits come from the settings table, managed by admin.
*/

CREATE OR REPLACE FUNCTION public.apply_wallet_entry(
  p_user_id uuid,
  p_entry_type text,
  p_amount bigint,
  p_reference_id text,
  p_description text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.wallet_ledger%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
BEGIN
  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'Jumlah transaksi tidak valid' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing FROM public.wallet_ledger WHERE reference_id = p_reference_id;
  IF FOUND THEN
    IF v_existing.user_id <> p_user_id OR v_existing.amount <> p_amount THEN
      RAISE EXCEPTION 'Referensi transaksi sudah digunakan' USING ERRCODE = '23505';
    END IF;
    RETURN v_existing.balance_after;
  END IF;

  UPDATE public.wallets
  SET balance = balance + p_amount
  WHERE user_id = p_user_id AND balance + p_amount >= 0
  RETURNING * INTO v_wallet;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saldo tidak mencukupi atau dompet tidak ditemukan' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.wallet_ledger (wallet_id, user_id, entry_type, amount, balance_after, reference_id, description)
  VALUES (v_wallet.id, p_user_id, p_entry_type, p_amount, v_wallet.balance, p_reference_id, COALESCE(p_description, ''));

  RETURN v_wallet.balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_wallet_entry(uuid, text, bigint, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_deposit(
  p_amount bigint,
  p_bank_account_id uuid,
  p_receipt_path text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_role text;
  v_min bigint;
  v_max bigint;
  v_pending integer;
  v_deposit_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Silakan masuk terlebih dahulu' USING ERRCODE = '28000';
  END IF;

  SELECT status, role INTO v_status, v_role FROM public.users WHERE id = v_uid;
  IF v_status IS DISTINCT FROM 'active' OR v_role <> 'agent' THEN
    RAISE EXCEPTION 'Akun Anda tidak dapat melakukan deposit' USING ERRCODE = '42501';
  END IF;

  SELECT (value #>> '{}')::bigint INTO v_min FROM public.settings WHERE key = 'deposit_min_amount';
  SELECT (value #>> '{}')::bigint INTO v_max FROM public.settings WHERE key = 'deposit_max_amount';
  IF p_amount IS NULL OR p_amount < v_min OR p_amount > v_max THEN
    RAISE EXCEPTION 'Nominal deposit harus antara % dan %', v_min, v_max USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bank_accounts WHERE id = p_bank_account_id AND is_active) THEN
    RAISE EXCEPTION 'Rekening tujuan tidak valid' USING ERRCODE = '22023';
  END IF;

  IF p_receipt_path IS NULL OR p_receipt_path NOT LIKE (v_uid::text || '/%') OR p_receipt_path LIKE '%..%' THEN
    RAISE EXCEPTION 'Bukti transfer tidak valid' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_pending FROM public.deposits WHERE user_id = v_uid AND status = 'pending';
  IF v_pending >= 5 THEN
    RAISE EXCEPTION 'Anda sudah memiliki 5 deposit yang menunggu verifikasi' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.deposits (user_id, bank_account_id, amount, receipt_path)
  VALUES (v_uid, p_bank_account_id, p_amount, p_receipt_path)
  RETURNING id INTO v_deposit_id;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
  VALUES (v_uid, 'deposit.submit', 'deposits', v_deposit_id::text, jsonb_build_object('amount', p_amount));

  RETURN v_deposit_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_deposit(bigint, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_deposit(bigint, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_deposit(
  p_deposit_id uuid,
  p_decision text,
  p_note text DEFAULT ''
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_dep public.deposits%ROWTYPE;
  v_ref text;
  v_new_status text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Keputusan tidak valid' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_dep FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deposit tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;
  IF v_dep.status <> 'pending' THEN
    RAISE EXCEPTION 'Deposit ini sudah diproses sebelumnya' USING ERRCODE = 'P0001';
  END IF;

  IF p_decision = 'approve' THEN
    v_ref := 'DEP-' || v_dep.id::text;
    PERFORM public.apply_wallet_entry(v_dep.user_id, 'deposit', v_dep.amount, v_ref, 'Deposit transfer bank disetujui');
    v_new_status := 'approved';

    UPDATE public.deposits
    SET status = 'approved', reviewed_by = v_admin, reviewed_at = now(),
        admin_note = left(COALESCE(p_note, ''), 500), ledger_reference = v_ref
    WHERE id = v_dep.id;

    INSERT INTO public.notifications (user_id, title, body)
    VALUES (v_dep.user_id, 'Deposit disetujui', 'Deposit Anda telah diverifikasi dan saldo sudah bertambah.');
  ELSE
    v_new_status := 'rejected';

    UPDATE public.deposits
    SET status = 'rejected', reviewed_by = v_admin, reviewed_at = now(),
        admin_note = left(COALESCE(p_note, ''), 500)
    WHERE id = v_dep.id;

    INSERT INTO public.notifications (user_id, title, body)
    VALUES (v_dep.user_id, 'Deposit ditolak', 'Deposit Anda tidak dapat diverifikasi. Silakan cek catatan admin dan kirim ulang.');
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
  VALUES (v_admin, 'deposit.' || v_new_status, 'deposits', v_dep.id::text,
          jsonb_build_object('amount', v_dep.amount, 'user_id', v_dep.user_id, 'note', left(COALESCE(p_note, ''), 500)));

  RETURN v_new_status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_deposit(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_deposit(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_wallet_adjustment(
  p_user_id uuid,
  p_amount bigint,
  p_note text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_ref text;
  v_balance bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;
  IF p_note IS NULL OR char_length(trim(p_note)) < 5 THEN
    RAISE EXCEPTION 'Catatan penyesuaian wajib diisi (minimal 5 karakter)' USING ERRCODE = '22023';
  END IF;

  v_ref := 'ADJ-' || gen_random_uuid()::text;
  v_balance := public.apply_wallet_entry(p_user_id, 'adjustment', p_amount, v_ref, left(trim(p_note), 500));

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (p_user_id, 'Penyesuaian saldo', 'Saldo dompet Anda telah disesuaikan oleh admin.');

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
  VALUES (v_admin, 'wallet.adjustment', 'wallets', p_user_id::text,
          jsonb_build_object('amount', p_amount, 'reference', v_ref, 'note', left(trim(p_note), 500)));

  RETURN v_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_wallet_adjustment(uuid, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_wallet_adjustment(uuid, bigint, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_agent_status(p_user_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_role text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'Status tidak valid' USING ERRCODE = '22023';
  END IF;
  IF p_user_id = v_admin THEN
    RAISE EXCEPTION 'Anda tidak dapat mengubah status akun sendiri' USING ERRCODE = '22023';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = p_user_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Agen tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;
  IF v_role <> 'agent' THEN
    RAISE EXCEPTION 'Hanya status agen yang dapat diubah' USING ERRCODE = '22023';
  END IF;

  UPDATE public.users SET status = p_status WHERE id = p_user_id;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
  VALUES (v_admin, 'agent.status_' || p_status, 'users', p_user_id::text, jsonb_build_object('status', p_status));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_agent_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_agent_status(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.agent_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today_start timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta';
  v_month_start timestamptz := date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Silakan masuk terlebih dahulu' USING ERRCODE = '28000';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'balance', COALESCE((SELECT balance FROM public.wallets WHERE user_id = v_uid), 0),
      'today_count', count(*) FILTER (WHERE t.created_at >= v_today_start),
      'today_sales', COALESCE(sum(t.selling_price) FILTER (WHERE t.created_at >= v_today_start), 0),
      'today_profit', COALESCE(sum(t.profit) FILTER (WHERE t.created_at >= v_today_start), 0),
      'month_count', count(*) FILTER (WHERE t.created_at >= v_month_start),
      'month_sales', COALESCE(sum(t.selling_price) FILTER (WHERE t.created_at >= v_month_start), 0),
      'month_profit', COALESCE(sum(t.profit) FILTER (WHERE t.created_at >= v_month_start), 0),
      'total_profit', COALESCE(sum(t.profit), 0)
    )
    FROM public.transactions t
    WHERE t.user_id = v_uid AND t.status = 'success'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.agent_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agent_dashboard_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total_agents', (SELECT count(*) FROM public.users WHERE role = 'agent'),
    'active_agents', (SELECT count(*) FROM public.users WHERE role = 'agent' AND status = 'active'),
    'total_wallet_balance', COALESCE((SELECT sum(balance) FROM public.wallets), 0),
    'approved_deposit_total', COALESCE((SELECT sum(amount) FROM public.deposits WHERE status = 'approved'), 0),
    'approved_deposit_count', (SELECT count(*) FROM public.deposits WHERE status = 'approved'),
    'pending_deposit_count', (SELECT count(*) FROM public.deposits WHERE status = 'pending'),
    'total_transactions', (SELECT count(*) FROM public.transactions WHERE status = 'success'),
    'total_sales', COALESCE((SELECT sum(selling_price) FROM public.transactions WHERE status = 'success'), 0),
    'total_gross_profit', COALESCE((SELECT sum(profit) FROM public.transactions WHERE status = 'success'), 0),
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', to_char(d.day, 'YYYY-MM-DD'), 'sales', d.sales, 'profit', d.profit, 'count', d.cnt) ORDER BY d.day)
      FROM (
        SELECT g.day::date AS day,
          COALESCE(sum(t.selling_price), 0) AS sales,
          COALESCE(sum(t.profit), 0) AS profit,
          count(t.id) AS cnt
        FROM generate_series(v_today - 13, v_today, interval '1 day') AS g(day)
        LEFT JOIN public.transactions t
          ON t.status = 'success' AND (t.created_at AT TIME ZONE 'Asia/Jakarta')::date = g.day::date
        GROUP BY g.day
      ) d
    ), '[]'::jsonb),
    'monthly', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', to_char(m.month, 'YYYY-MM'), 'sales', m.sales, 'profit', m.profit, 'count', m.cnt) ORDER BY m.month)
      FROM (
        SELECT g.month AS month,
          COALESCE(sum(t.selling_price), 0) AS sales,
          COALESCE(sum(t.profit), 0) AS profit,
          count(t.id) AS cnt
        FROM generate_series(
          date_trunc('month', v_today::timestamp) - interval '11 months',
          date_trunc('month', v_today::timestamp),
          interval '1 month'
        ) AS g(month)
        LEFT JOIN public.transactions t
          ON t.status = 'success' AND date_trunc('month', t.created_at AT TIME ZONE 'Asia/Jakarta') = g.month
        GROUP BY g.month
      ) m
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_transactions(p_limit integer DEFAULT 100)
RETURNS SETOF public.transactions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT * FROM public.transactions
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_transactions(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_transactions(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  INSERT INTO public.users (id, email, full_name, phone, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    left(COALESCE(v_meta->>'full_name', ''), 120),
    left(COALESCE(v_meta->>'phone', ''), 30),
    'agent',
    'active'
  );

  INSERT INTO public.agent_profiles (user_id, business_name, city)
  VALUES (
    NEW.id,
    left(COALESCE(v_meta->>'business_name', ''), 120),
    left(COALESCE(v_meta->>'city', ''), 80)
  );

  INSERT INTO public.wallets (user_id) VALUES (NEW.id);

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
  VALUES (NEW.id, 'agent.register', 'users', NEW.id::text, jsonb_build_object('email', NEW.email));

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
