/*
# Deposit receipt storage and default settings

Creates a private storage bucket for deposit payment receipts and seeds the deposit limits.

## 1. New storage
- deposit-receipts: private bucket, 5 MB limit, images and PDF only.
  Files are stored in a folder named after the agent's user ID.

## 2. Security
- Agents can upload only into their own folder and can read only their own receipts.
- Admins can read any receipt so they can verify deposits.
- No update or delete access to receipts for clients.

## 3. Settings
- deposit_min_amount: 50,000 IDR.
- deposit_max_amount: 50,000,000 IDR.
- Seeded only when missing, so admin changes are never overwritten.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deposit-receipts',
  'deposit-receipts',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

DROP POLICY IF EXISTS "deposit_receipts_insert_own" ON storage.objects;
CREATE POLICY "deposit_receipts_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'deposit-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "deposit_receipts_select_own_or_admin" ON storage.objects;
CREATE POLICY "deposit_receipts_select_own_or_admin" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'deposit-receipts'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

INSERT INTO public.settings (key, value, description)
VALUES
  ('deposit_min_amount', '50000'::jsonb, 'Minimal nominal deposit (IDR)'),
  ('deposit_max_amount', '50000000'::jsonb, 'Maksimal nominal deposit (IDR)')
ON CONFLICT (key) DO NOTHING;
