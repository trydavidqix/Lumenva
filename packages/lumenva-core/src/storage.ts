export interface StateStorage { get<T>(key:string):Promise<T|null>; set<T>(key:string,value:T):Promise<void>; delete(key:string):Promise<void>; }
export class MemoryStateStorage implements StateStorage {
 #data=new Map<string,string>();
 async get<T>(key:string){const v=this.#data.get(key); return v===undefined?null:JSON.parse(v) as T;}
 async set<T>(key:string,value:T){this.#data.set(key,JSON.stringify(value));}
 async delete(key:string){this.#data.delete(key);}
}
export interface SqliteLike { exec(sql:string):unknown; prepare(sql:string):{ get(...args:unknown[]):unknown; run(...args:unknown[]):unknown }; }
export class SqliteStateStorage implements StateStorage {
 constructor(private readonly db:SqliteLike){ db.exec('CREATE TABLE IF NOT EXISTS lumenva_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)'); }
 async get<T>(key:string){ const row=this.db.prepare('SELECT value FROM lumenva_state WHERE key = ?').get(key) as {value?:string}|undefined; return row?.value?JSON.parse(row.value) as T:null; }
 async set<T>(key:string,value:T){ this.db.prepare('INSERT INTO lumenva_state(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at').run(key,JSON.stringify(value),new Date().toISOString()); }
 async delete(key:string){this.db.prepare('DELETE FROM lumenva_state WHERE key = ?').run(key);}
}
