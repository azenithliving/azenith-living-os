export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table = {
  Row: Record<string, any>;
  Insert: Record<string, any>;
  Update: Record<string, any>;
};

type Tables = {
  [tableName: string]: Table;
};

export type Database = {
  public: {
    Tables: Tables;
    Views: Record<string, Table>;
    Functions: Record<string, any>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, any>;
  };
};
