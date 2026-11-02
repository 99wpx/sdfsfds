import { formatRupiah } from '@/lib/format';

export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

export function parseRupiahInput(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '');
  return digits === '' ? NaN : Number(digits);
}

export function validateDepositAmount(amount: number, limits: { min: number; max: number }): string | null {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return 'Masukkan nominal deposit yang valid';
  }
  if (amount < limits.min) {
    return `Nominal minimal deposit ${formatRupiah(limits.min)}`;
  }
  if (amount > limits.max) {
    return `Nominal maksimal deposit ${formatRupiah(limits.max)}`;
  }
  return null;
}

export function validateReceiptFile(file: File): string | null {
  if (!(RECEIPT_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Bukti transfer harus berupa JPG, PNG, WEBP, atau PDF';
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return 'Ukuran bukti transfer maksimal 5 MB';
  }
  return null;
}
