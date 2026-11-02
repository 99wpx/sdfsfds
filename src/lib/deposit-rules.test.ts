import { describe, expect, it } from 'vitest';
import { parseRupiahInput, validateDepositAmount, validateReceiptFile } from '@/lib/deposit-rules';

const limits = { min: 50_000, max: 50_000_000 };

describe('parseRupiahInput', () => {
  it('strips separators and returns an integer', () => {
    expect(parseRupiahInput('1.500.000')).toBe(1_500_000);
    expect(parseRupiahInput('Rp 75,000')).toBe(75_000);
  });

  it('returns NaN for empty input', () => {
    expect(parseRupiahInput('')).toBeNaN();
    expect(parseRupiahInput('abc')).toBeNaN();
  });
});

describe('validateDepositAmount', () => {
  it('accepts amounts inside the limits', () => {
    expect(validateDepositAmount(50_000, limits)).toBeNull();
    expect(validateDepositAmount(50_000_000, limits)).toBeNull();
  });

  it('rejects amounts below the minimum and above the maximum', () => {
    expect(validateDepositAmount(49_999, limits)).not.toBeNull();
    expect(validateDepositAmount(50_000_001, limits)).not.toBeNull();
  });

  it('rejects zero, negative, fractional and unsafe values', () => {
    expect(validateDepositAmount(0, limits)).not.toBeNull();
    expect(validateDepositAmount(-100_000, limits)).not.toBeNull();
    expect(validateDepositAmount(100.5, limits)).not.toBeNull();
    expect(validateDepositAmount(Number.NaN, limits)).not.toBeNull();
  });
});

describe('validateReceiptFile', () => {
  it('accepts supported types under 5 MB', () => {
    const file = new File(['x'], 'bukti.jpg', { type: 'image/jpeg' });
    expect(validateReceiptFile(file)).toBeNull();
  });

  it('rejects unsupported types and oversized files', () => {
    expect(validateReceiptFile(new File(['x'], 'a.exe', { type: 'application/x-msdownload' }))).not.toBeNull();
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });
    expect(validateReceiptFile(big)).not.toBeNull();
  });
});
