export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          display_name: string;
          email: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          email: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          display_name?: string;
          email?: string;
          status?: string;
        };
      };
      assets: {
        Row: {
          id: string;
          asset_code: string;
          name: string;
          owner_id: string;
          status: string;
          created_at: string;
        };
      };
      audit_events: {
        Row: {
          id: number;
          event_type: string;
          actor_id: string | null;
          target_id: string | null;
          event_hash: string;
          prev_hash: string;
          created_at: string;
        };
        Insert: {
          event_type: string;
          actor_id?: string | null;
          target_type?: string | null;
          target_id?: string | null;
          event_hash: string;
          prev_hash: string;
        };
      };
    };
  };
}
