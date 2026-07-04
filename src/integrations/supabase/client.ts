import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'placeholder';

// Standard Supabase client for online fallback / Android capacitor env
const realSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// A complete offline emulator of the Supabase Client for Electron Desktop
class SQLiteQueryBuilder {
  private table: string;
  private method: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private selectColumns: string = '*';
  private whereClause: { col: string; op: string; val: any }[] = [];
  private orderByCol: string | null = null;
  private orderAsc: boolean = true;
  private limitCount: number | null = null;
  private payload: any = null;
  private isSingle: boolean = false;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = '*') {
    this.method = 'select';
    this.selectColumns = columns;
    return this;
  }

  insert(payload: any) {
    this.method = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: any) {
    this.method = 'update';
    this.payload = payload;
    return this;
  }

  upsert(payload: any) {
    this.method = 'upsert';
    this.payload = payload;
    return this;
  }

  delete() {
    this.method = 'delete';
    return this;
  }

  eq(col: string, val: any) {
    this.whereClause.push({ col, op: '=', val });
    return this;
  }

  neq(col: string, val: any) {
    this.whereClause.push({ col, op: '<>', val });
    return this;
  }

  lt(col: string, val: any) {
    this.whereClause.push({ col, op: '<', val });
    return this;
  }

  lte(col: string, val: any) {
    this.whereClause.push({ col, op: '<=', val });
    return this;
  }

  gt(col: string, val: any) {
    this.whereClause.push({ col, op: '>', val });
    return this;
  }

  gte(col: string, val: any) {
    this.whereClause.push({ col, op: '>=', val });
    return this;
  }

  in(col: string, vals: any[]) {
    this.whereClause.push({ col, op: 'IN', val: vals });
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.orderByCol = col;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this;
  }

  // Support thenable behavior (Promise compatibility)
  async then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    try {
      const result = await this.execute();
      if (onfulfilled) return onfulfilled(result);
      return result;
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }

  private async execute() {
    if (!window.electronAPI) {
      throw new Error("electronAPI not available in environment");
    }

    try {
      if (this.method === 'select') {
        let sql = `SELECT ${this.table}.*`;
        let joinSql = '';

        // Dynamic Join mapping
        if (this.selectColumns.includes('employees(')) {
          sql += `, employees.first_name AS employees_first_name, employees.last_name AS employees_last_name, employees.employee_code AS employees_employee_code`;
          joinSql += ` LEFT JOIN employees ON ${this.table}.employee_id = employees.id`;
        }
        if (this.selectColumns.includes('leave_types(')) {
          sql += `, leave_types.name AS leave_types_name, leave_types.description AS leave_types_description`;
          joinSql += ` LEFT JOIN leave_types ON leaves.leave_type_id = leave_types.id`;
        }

        sql += ` FROM ${this.table}${joinSql}`;

        const params: any[] = [];
        if (this.whereClause.length > 0) {
          const conds = this.whereClause.map(w => {
            if (w.op === 'IN') {
              const placeholders = w.val.map(() => '?').join(', ');
              params.push(...w.val);
              return `${this.table}.${w.col} IN (${placeholders})`;
            }
            params.push(w.val);
            return `${this.table}.${w.col} ${w.op} ?`;
          });
          sql += ` WHERE ` + conds.join(' AND ');
        }

        if (this.orderByCol) {
          sql += ` ORDER BY ${this.table}.${this.orderByCol} ${this.orderAsc ? 'ASC' : 'DESC'}`;
        }

        if (this.limitCount !== null) {
          sql += ` LIMIT ${this.limitCount}`;
        }

        const rows = await window.electronAPI.dbQuery(sql, params);

        // Map nested objects for joined tables
        const mappedRows = rows.map((row: any) => {
          const newRow = { ...row };

          // Map employees relation
          if (this.selectColumns.includes('employees(')) {
            newRow.employees = {
              first_name: row.employees_first_name || null,
              last_name: row.employees_last_name || null,
              employee_code: row.employees_employee_code || null,
            };
            delete newRow.employees_first_name;
            delete newRow.employees_last_name;
            delete newRow.employees_employee_code;
          }

          // Map leave_types relation
          if (this.selectColumns.includes('leave_types(')) {
            newRow.leave_types = {
              name: row.leave_types_name || null,
              description: row.leave_types_description || null,
            };
            delete newRow.leave_types_name;
            delete newRow.leave_types_description;
          }

          return newRow;
        });

        if (this.isSingle) {
          return { data: mappedRows.length > 0 ? mappedRows[0] : null, error: null };
        }
        return { data: mappedRows, error: null };
      }

      if (this.method === 'insert') {
        const payloads = Array.isArray(this.payload) ? this.payload : [this.payload];
        for (const item of payloads) {
          const itemCopy = { ...item };
          if (!itemCopy.id) itemCopy.id = crypto.randomUUID();
          itemCopy.sync_status = 'pending';

          // Generate created_at/updated_at if missing
          const nowStr = new Date().toISOString();
          if (!itemCopy.created_at) itemCopy.created_at = nowStr;
          if ('updated_at' in itemCopy || itemCopy.updated_at === undefined) itemCopy.updated_at = nowStr;

          const keys = Object.keys(itemCopy);
          const placeholders = keys.map(() => '?').join(', ');
          const values = Object.values(itemCopy);

          const sql = `INSERT OR REPLACE INTO ${this.table} (${keys.join(', ')}) VALUES (${placeholders})`;
          await window.electronAPI.dbExecute(sql, values);
        }
        return { data: this.payload, error: null };
      }

      if (this.method === 'update') {
        const itemCopy = { ...this.payload };
        itemCopy.sync_status = 'pending';
        itemCopy.updated_at = new Date().toISOString();

        const sets = Object.keys(itemCopy).map(k => `${k} = ?`).join(', ');
        const params = Object.values(itemCopy);

        let sql = `UPDATE ${this.table} SET ${sets}`;

        if (this.whereClause.length > 0) {
          const conds = this.whereClause.map(w => {
            if (w.op === 'IN') {
              const placeholders = w.val.map(() => '?').join(', ');
              params.push(...w.val);
              return `${w.col} IN (${placeholders})`;
            }
            params.push(w.val);
            return `${w.col} ${w.op} ?`;
          });
          sql += ` WHERE ` + conds.join(' AND ');
        }

        await window.electronAPI.dbExecute(sql, params);
        return { data: this.payload, error: null };
      }

      if (this.method === 'upsert') {
        const payloads = Array.isArray(this.payload) ? this.payload : [this.payload];
        for (const item of payloads) {
          const itemCopy = { ...item };
          if (!itemCopy.id) itemCopy.id = crypto.randomUUID();
          itemCopy.sync_status = 'pending';

          const nowStr = new Date().toISOString();
          if (!itemCopy.created_at) itemCopy.created_at = nowStr;
          itemCopy.updated_at = nowStr;

          const keys = Object.keys(itemCopy);
          const placeholders = keys.map(() => '?').join(', ');
          const values = Object.values(itemCopy);

          const sql = `INSERT OR REPLACE INTO ${this.table} (${keys.join(', ')}) VALUES (${placeholders})`;
          await window.electronAPI.dbExecute(sql, values);
        }
        return { data: this.payload, error: null };
      }

      if (this.method === 'delete') {
        let sql = `DELETE FROM ${this.table}`;
        const params: any[] = [];
        if (this.whereClause.length > 0) {
          const conds = this.whereClause.map(w => {
            if (w.op === 'IN') {
              const placeholders = w.val.map(() => '?').join(', ');
              params.push(...w.val);
              return `${w.col} IN (${placeholders})`;
            }
            params.push(w.val);
            return `${w.col} ${w.op} ?`;
          });
          sql += ` WHERE ` + conds.join(' AND ');
        }
        await window.electronAPI.dbExecute(sql, params);
        return { data: null, error: null };
      }

      return { data: null, error: new Error('Unsupported method') };
    } catch (e: any) {
      console.error(`SQLite emulation error on table ${this.table}:`, e.message);
      return { data: null, error: e };
    }
  }
}

let offlineSession: any = null;
let authSubscribers: Array<(event: string, session: any) => void> = [];

const notifyAuthStateChange = (event: string, session: any) => {
  authSubscribers.forEach(callback => {
    try {
      callback(event, session);
    } catch (err) {
      console.error('Offline auth callback error:', err);
    }
  });
};

const loadOfflineSession = () => {
  const saved = localStorage.getItem('offline_session');
  offlineSession = saved ? JSON.parse(saved) : null;
  return offlineSession;
};

// Wrapper mock of Supabase client for desktop environment
const supabaseDesktopMock: any = {
  from: (table: string) => {
    return new SQLiteQueryBuilder(table);
  },
  auth: {
    signInWithPassword: async ({ email, password }: any) => {
      // Offline fallback login for admin
      if (email === 'adrian.llano79@gmail.com' && password === '111111') {
        const mockUser = {
          id: 'offline-admin-id',
          email: 'adrian.llano79@gmail.com',
          user_metadata: { full_name: 'Offline Admin' }
        };
        const mockSession = {
          access_token: 'offline-token',
          user: mockUser
        };
        offlineSession = mockSession;
        localStorage.setItem('offline_session', JSON.stringify(mockSession));
        notifyAuthStateChange('SIGNED_IN', mockSession);
        return { data: { user: mockUser, session: mockSession }, error: null };
      }
      return { data: { user: null, session: null }, error: new Error("Invalid local credentials") };
    },
    signUp: async ({ email, password, options }: any) => {
      return { data: { user: null, session: null }, error: new Error("Sign up is disabled in offline mode") };
    },
    signOut: async () => {
      offlineSession = null;
      localStorage.removeItem('offline_session');
      notifyAuthStateChange('SIGNED_OUT', null);
      return { error: null };
    },
    getSession: async () => {
      const savedSession = loadOfflineSession();
      return { data: { session: savedSession }, error: null };
    },
    onAuthStateChange: (callback: any) => {
      authSubscribers.push(callback);
      const saved = loadOfflineSession();
      if (saved) {
        callback('SIGNED_IN', saved);
      } else {
        callback('SIGNED_OUT', null);
      }
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authSubscribers = authSubscribers.filter(sub => sub !== callback);
            }
          }
        }
      };
    }
  }
};

export const supabase = window.electronAPI ? supabaseDesktopMock : realSupabase;
export { realSupabase };