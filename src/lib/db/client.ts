import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export function isSupabaseConfigured(): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return Boolean(
    supabaseUrl &&
    !supabaseUrl.includes('localhost:8000') &&
    !supabaseUrl.includes('your-project') &&
    (
      (supabaseServiceKey && !supabaseServiceKey.includes('dummy') && !supabaseServiceKey.includes('your-service-role-key')) ||
      (supabaseAnonKey && !supabaseAnonKey.includes('dummy') && !supabaseAnonKey.includes('your-anon-key'))
    )
  );
}

const createMockChain = () => {
  const chain: any = {
    select: () => chain,
    insert: () => Promise.resolve({ data: null, error: new Error('Supabase offline / not configured') }),
    update: () => Promise.resolve({ data: null, error: new Error('Supabase offline / not configured') }),
    delete: () => Promise.resolve({ data: null, error: new Error('Supabase offline / not configured') }),
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    single: () => Promise.resolve({ data: null, error: new Error('Supabase offline / not configured') }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  };
  return chain;
};

const mockClient: any = {
  from: () => createMockChain(),
  storage: {
    from: () => ({
      upload: () => Promise.resolve({ data: null, error: new Error('Supabase offline / not configured') }),
      download: () => Promise.resolve({ data: null, error: new Error('Supabase offline / not configured') }),
      list: () => Promise.resolve({ data: [], error: null }),
    }),
    listBuckets: () => Promise.resolve({ data: [], error: null }),
  },
};

let _adminClient: any = null;
let _publicClient: any = null;

// Client strictly for server-side secure operations (bypasses RLS)
export const supabaseAdmin: any = new Proxy({}, {
  get(_target, prop) {
    if (!isSupabaseConfigured()) return mockClient[prop];
    if (!_adminClient) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      _adminClient = createClient<Database>(url, key);
    }
    const val = _adminClient[prop];
    return typeof val === 'function' ? val.bind(_adminClient) : val;
  },
});

// Client for public operations and browser environments
export const supabaseClient: any = new Proxy({}, {
  get(_target, prop) {
    if (!isSupabaseConfigured()) return mockClient[prop];
    if (!_publicClient) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
      _publicClient = createClient<Database>(url, key);
    }
    const val = _publicClient[prop];
    return typeof val === 'function' ? val.bind(_publicClient) : val;
  },
});

// Function to generate a client dynamically bound to a user's JWT
// This enforces RLS and prevents IDOR (as per Hostile Review Architecture updates)
export const createAuthenticatedClient = (jwt: string) => {
  if (!isSupabaseConfigured()) return mockClient;
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    }
  );
};
