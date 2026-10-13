import { isLedgerKey, type StoredKey } from "@/shared/storage/table-keys";

/**
 * Change log ("nhật ký thay đổi"): what changed between two saved versions of
 * a table, one entry per record added, edited or removed. The server runs this
 * on every save (`PUT /api/tables`), so nothing written to the database escapes
 * it, whichever screen or device made the change.
 *
 * Pure and shared: the server writes entries, the Activity page reads them.
 */

export const AUDIT_ACTIONS = ["add", "update", "remove"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITY_TYPES = [
  "expense",
  "expense_month",
  "spending_estimate",
  "income_source",
  "asset",
  "legacy_real_estate",
  "legacy_cash",
  "legacy_investment",
  "debt",
  "personal_loan",
  "goal_plan",
  "goal_primary",
  "settings",
  "transaction",
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/** One changed field: dotted path for nested settings (`milestone.birthDate`). */
export type AuditFieldChange = { field: string; before: unknown; after: unknown };

export type AuditChange = {
  entityType: AuditEntityType;
  entityId: string;
  /** Readable name at the time (a bill's name, a debt's name, the person for a loan). */
  entityName: string | null;
  action: AuditAction;
  /** Fields that changed (updates only). */
  changes: AuditFieldChange[] | null;
  /** The whole record before / after (null when added / removed). */
  before: unknown;
  after: unknown;
};

/** Extra facts some tables need: bill names for month check-offs and transactions, income source names. */
export type AuditContext = { expenseNames?: ReadonlyMap<string, string>; incomeNames?: ReadonlyMap<string, string> };

/**
 * Preferences fields left out of the log: view state (which matrix filter or
 * sort is on) and bookkeeping the app recomputes by itself from assets and
 * debts (whose own changes are logged).
 */
export const AUDIT_IGNORED_PREFERENCE_FIELDS = [
  "netWorthMonthKey",
  "netWorthMonthBaseline",
  "lastKnownNetWorth",
  "netWorthMonthlyHistory",
  "allocationsBandFilter",
  "allocationsMatrixColumnSort",
] as const;

type Entity = { type: AuditEntityType; id: string; name: string | null; value: unknown };
type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Records with a string `id` (anything else can't be tracked across versions). */
function records(v: unknown): Obj[] {
  return Array.isArray(v) ? v.filter((r): r is Obj => isObj(r) && typeof r.id === "string" && r.id !== "") : [];
}

function addAll(out: Map<string, Entity>, type: AuditEntityType, list: unknown, name: (r: Obj) => string | null) {
  for (const r of records(list)) {
    out.set(`${type}:${r.id}`, { type, id: r.id as string, name: name(r), value: r });
  }
}

/** Expense item id → name, for naming check-offs. */
export function expenseNamesOf(expensesDoc: unknown): Map<string, string> {
  const names = new Map<string, string>();
  if (!isObj(expensesDoc)) return names;
  for (const r of records(expensesDoc.items)) {
    const n = str(r.name);
    if (n) names.set(r.id as string, n);
  }
  return names;
}

/** Income source id → name, for naming money received. */
export function incomeNamesOf(sources: unknown): Map<string, string> {
  const names = new Map<string, string>();
  for (const r of records(sources)) {
    const n = str(r.name);
    if (n) names.set(r.id as string, n);
  }
  return names;
}

/** A transaction's name: its own, else its bill / budget / income source's. */
function transactionName(t: Obj, ctx: AuditContext): string | null {
  const own = str(t.name);
  if (own) return own;
  const src = isObj(t.source) ? t.source : {};
  if (typeof src.itemId === "string") return ctx.expenseNames?.get(src.itemId) ?? null;
  if (typeof src.sourceId === "string") return ctx.incomeNames?.get(src.sourceId) ?? null;
  return null;
}

/** Every trackable record of one table document, keyed `type:id`. */
export function auditEntities(key: StoredKey, doc: unknown, ctx: AuditContext = {}): Map<string, Entity> {
  const out = new Map<string, Entity>();
  if (doc === null || doc === undefined) return out;
  if (isLedgerKey(key)) {
    // A month of money in and out; the "don't recreate" list is bookkeeping.
    if (isObj(doc)) addAll(out, "transaction", doc.txns, (r) => transactionName(r, ctx));
    return out;
  }
  switch (key) {
    case "settingsAssets":
      addAll(out, "asset", doc, (r) => str(r.name));
      break;
    case "debts":
      addAll(out, "debt", doc, (r) => str(r.name));
      break;
    case "incomeSources":
      addAll(out, "income_source", doc, (r) => str(r.name));
      break;
    case "personalLoans":
      addAll(out, "personal_loan", doc, (r) => str(r.person));
      break;
    case "assets":
      if (isObj(doc)) {
        addAll(out, "legacy_real_estate", doc.realEstate, (r) => str(r.name));
        addAll(out, "legacy_cash", doc.cashAccounts, (r) => [str(r.category), str(r.details)].filter(Boolean).join(" · ") || null);
        addAll(out, "legacy_investment", doc.investments, (r) => str(r.name));
      }
      break;
    case "goals":
      if (isObj(doc)) {
        addAll(out, "goal_plan", doc.profiles, (r) => str(r.name));
        // `activeProfileId` is just which plan is open on screen.
        if (isObj(doc.primary)) {
          out.set("goal_primary:primary", { type: "goal_primary", id: "primary", name: str(doc.primary.name), value: doc.primary });
        }
      }
      break;
    case "expenses":
      if (isObj(doc)) {
        addAll(out, "expense", doc.items, (r) => str(r.name));
        if (isObj(doc.legacyEstimate)) {
          out.set("spending_estimate:legacy", { type: "spending_estimate", id: "legacy", name: null, value: doc.legacyEstimate });
        }
      }
      break;
    case "expenseLog":
      if (isObj(doc) && isObj(doc.months)) {
        for (const [month, entries] of Object.entries(doc.months)) {
          if (!isObj(entries)) continue;
          for (const [itemId, entry] of Object.entries(entries)) {
            if (!isObj(entry)) continue;
            const id = `${month}:${itemId}`;
            out.set(`expense_month:${id}`, { type: "expense_month", id, name: ctx.expenseNames?.get(itemId) ?? null, value: entry });
          }
        }
      }
      break;
    case "preferences":
      if (isObj(doc)) {
        const value: Obj = { ...doc };
        for (const f of AUDIT_IGNORED_PREFERENCE_FIELDS) delete value[f];
        out.set("settings:preferences", { type: "settings", id: "preferences", name: null, value });
      }
      break;
  }
  return out;
}

/** Structural equality for JSON values; a missing key equals `undefined`. */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return Number.isNaN(a) && Number.isNaN(b);
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((v, i) => jsonEqual(v, bb[i]));
  }
  const ao = a as Obj;
  const bo = b as Obj;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    if (!jsonEqual(ao[k], bo[k])) return false;
  }
  return true;
}

/** Changed fields; nested plain objects (settings groups) are compared one level down. */
export function fieldChanges(before: unknown, after: unknown, prefix = "", depth = 0): AuditFieldChange[] {
  if (!isObj(before) || !isObj(after)) {
    return jsonEqual(before, after) ? [] : [{ field: prefix, before: before ?? null, after: after ?? null }];
  }
  const out: AuditFieldChange[] = [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  for (const k of keys) {
    const b = before[k];
    const a = after[k];
    if (jsonEqual(b, a)) continue;
    const path = prefix ? `${prefix}.${k}` : k;
    // A settings group added or removed whole still reads field by field.
    const group = (v: unknown) => isObj(v) || v === undefined || v === null;
    if (depth < 1 && (isObj(b) || isObj(a)) && group(b) && group(a)) out.push(...fieldChanges(b ?? {}, a ?? {}, path, depth + 1));
    else out.push({ field: path, before: b ?? null, after: a ?? null });
  }
  return out;
}

/** Log entries for saving `after` over `before` (either may be missing). */
export function diffTable(key: StoredKey, before: unknown, after: unknown, ctx: AuditContext = {}): AuditChange[] {
  const was = auditEntities(key, before, ctx);
  const now = auditEntities(key, after, ctx);
  const out: AuditChange[] = [];
  for (const [k, e] of now) {
    const prev = was.get(k);
    if (!prev) {
      out.push({ entityType: e.type, entityId: e.id, entityName: e.name, action: "add", changes: null, before: null, after: e.value });
    } else if (!jsonEqual(prev.value, e.value)) {
      out.push({
        entityType: e.type,
        entityId: e.id,
        entityName: e.name ?? prev.name,
        action: "update",
        changes: fieldChanges(prev.value, e.value),
        before: prev.value,
        after: e.value,
      });
    }
  }
  for (const [k, e] of was) {
    if (!now.has(k)) {
      out.push({ entityType: e.type, entityId: e.id, entityName: e.name, action: "remove", changes: null, before: e.value, after: null });
    }
  }
  return out;
}
