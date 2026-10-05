/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Just enough of the firebase-admin Firestore API for the route handlers:
 * doc refs, equality and "in" queries, getAll, batches and transactions.
 * Transactions buffer writes and apply them only if the callback succeeds.
 */
let seq = 0;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v ?? null));

class DocRef {
  constructor(private db: FakeDb, public col: string, public id: string) {}
  private get map() { return this.db.table(this.col); }
  async get() {
    const d = this.map.get(this.id);
    return { id: this.id, exists: d !== undefined, data: () => (d === undefined ? undefined : clone(d)) };
  }
  _exists() { return this.map.has(this.id); }
  _set(d: any) { this.map.set(this.id, clone(d)); }
  _update(d: any) {
    if (!this._exists()) throw Object.assign(new Error("NOT_FOUND"), { code: 5 });
    this.map.set(this.id, { ...this.map.get(this.id), ...clone(d) });
  }
}

class Query {
  constructor(private db: FakeDb, private col: string, private filters: [string, string, any][] = []) {}
  where(f: string, op: string, v: any) { return new Query(this.db, this.col, [...this.filters, [f, op, v]]); }
  orderBy() { return this; }
  limit() { return this; }
  async get() {
    const docs = [...this.db.table(this.col).entries()]
      .filter(([, d]) => this.filters.every(([f, op, v]) => (op === "==" ? d[f] === v : op === "in" ? v.includes(d[f]) : false)))
      .map(([id, d]) => ({ id, exists: true, data: () => clone(d) }));
    return { docs, size: docs.length, empty: !docs.length };
  }
}

class Col extends Query {
  constructor(private _db: FakeDb, private _name: string) { super(_db, _name); }
  doc(id?: string) { return new DocRef(this._db, this._name, id ?? `auto${++seq}`); }
}

export class FakeDb {
  tables = new Map<string, Map<string, any>>();
  table(n: string) {
    if (!this.tables.has(n)) this.tables.set(n, new Map());
    return this.tables.get(n)!;
  }
  collection(n: string) { return new Col(this, n); }
  getAll(...refs: DocRef[]) { return Promise.all(refs.map((r) => r.get())); }
  batch() {
    const ops: (() => void)[] = [];
    return {
      set: (r: DocRef, d: any) => void ops.push(() => r._set(d)),
      commit: async () => ops.forEach((f) => f()),
    };
  }
  async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const ops: (() => void)[] = [];
    const tx = {
      get: (r: DocRef) => r.get(),
      update: (r: DocRef, d: any) => void ops.push(() => r._update(d)),
      set: (r: DocRef, d: any) => void ops.push(() => r._set(d)),
      create: (r: DocRef, d: any) => void ops.push(() => {
        if (r._exists()) throw Object.assign(new Error("ALREADY_EXISTS"), { code: 6 });
        r._set(d);
      }),
    };
    const out = await fn(tx);
    ops.forEach((f) => f());
    return out;
  }
  all(col: string) { return [...this.table(col).entries()].map(([id, d]) => ({ id, ...d })); }
}
