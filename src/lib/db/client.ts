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

const createMockChain = (): any => {
  const resultPromise = Promise.resolve({ data: null, error: null, count: 0 });

  const handler: ProxyHandler<any> = {
    get(_target, prop, receiver) {
      if (prop === 'then') {
        return (onFulfilled?: any, onRejected?: any) => resultPromise.then(onFulfilled, onRejected);
      }
      if (prop === 'catch') {
        return (onRejected?: any) => resultPromise.catch(onRejected);
      }
      if (prop === 'finally') {
        return (onFinally?: any) => resultPromise.finally(onFinally);
      }
      if (prop === 'single' || prop === 'maybeSingle') {
        return () => Promise.resolve({ data: null, error: null, count: 0 });
      }
      // Return a function that returns the mock query builder receiver for any chaining method
      // (select, insert, update, upsert, delete, eq, neq, in, order, limit, match, filter, etc.)
      return (..._args: any[]) => receiver;
    },
  };

  return new Proxy({}, handler);
};

const mockClient: any = {
  from: () => createMockChain(),
  rpc: () => createMockChain(),
  storage: {
    from: () => ({
      upload: () => Promise.resolve({ data: null, error: null }),
      download: () => Promise.resolve({ data: null, error: null }),
      list: () => Promise.resolve({ data: [], error: null }),
      remove: () => Promise.resolve({ data: [], error: null }),
      createSignedUrl: () => Promise.resolve({ data: { signedUrl: '' }, error: null }),
      createSignedUrls: () => Promise.resolve({ data: [], error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
    listBuckets: () => Promise.resolve({ data: [], error: null }),
    getBucket: () => Promise.resolve({ data: null, error: null }),
    createBucket: () => Promise.resolve({ data: null, error: null }),
  },
  auth: {
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    signOut: () => Promise.resolve({ error: null }),
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
