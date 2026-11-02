import { supabase } from '@/lib/supabase';

export interface UserSummary {
  full_name: string;
  email: string;
}

export async function fetchUserSummaries(ids: string[]): Promise<Map<string, UserSummary>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.from('users').select('id, full_name, email').in('id', unique);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((row) => [row.id as string, { full_name: row.full_name as string, email: row.email as string }]));
}
