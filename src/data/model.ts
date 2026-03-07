import PouchDB from "pouchdb-browser";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { FilePicker } from "@capawesome/capacitor-file-picker";

import { logger } from "@/lib/logger";

import {
  BudgetType,
  DEFAULT_BUDGET,
  DEFAULT_CATEGORIES,
  DEFAULT_COUCHDB_URL,
  DEFAULT_CURRENCY,
  DEFAULT_LANGUAGE,
  MODEL_SCHEMA_VERSION,
} from "./modelDefaults";

const currentVersion = MODEL_SCHEMA_VERSION;

export interface Budget {
  type: BudgetType;
  budget: number;
}

export { BudgetType };

export interface Expense {
  total_sum: string;
  max_budget: string;
  remains: string;
  budget_as_today: string;
}

export interface SingleExpense {
  // Note: UI expects this to be renderable, even if it's a string.
  // Historically this is treated as string in the UI.
  cost: any;
  date: Date;
  category: string;
}

export type RecurringFrequency = "monthly" | "yearly";

export interface AddRecurringExpenseInput {
  amount: number;
  category: string;
  frequency: RecurringFrequency;
  startDate?: Date | string | number;
  endDate?: Date | string | number;
  interval?: number;
}

export interface RecurringExpense {
  _id: string;
  amount: number;
  category: string;
  frequency: RecurringFrequency;
  interval: number;
  startDate: Date;
  endDate: Date | null;
  active: boolean;
}

export interface ListRecurringExpensesInput {
  start: Date | string | number;
  end: Date | string | number;
}

export interface HomePageLocalizer {
  x: string;
}

export interface ExpenseWithDate {
  total_sum: string;
  remains: number;
  date: string;
  month: number;
  year: number;
}

type SettingsDoc = {
  _id: "settings";
  type: "settings";
  currency: string;
  language: string;
  couchdbURL: string;
  budget: Budget;
  lastUpdate: number;
};

type CategoryDoc = {
  _id: string; // cat_<encoded-name>
  type: "category";
  name: string;
};

type MonthDoc = {
  _id: string; // month_<YYYYMM>
  type: "month";
  month: number; // 0..11
  year: number;
  budget: Budget;
};

type ExpenseDoc = {
  _id: string; // exp_<13-digit-ts>_<rand>
  type: "expense";
  ts: number;
  cost: number;
  category: string;
};

type RecurringExpenseDoc = {
  _id: string; // rexp_<rand>
  type: "recurring_expense";
  cost: number;
  category: string;
  startTs: number;
  endTs?: number;
  frequency: RecurringFrequency;
  interval: number;
  dayOfMonth: number;
  monthOfYear?: number;
  active: boolean;
};

type RecurringSkipDoc = {
  _id: string; // rskip_<encoded-series-id>_<13-digit-ts>
  type: "recurring_skip";
  recurringId: string;
  occurrenceTs: number;
};

type ExpenseListDoc = ExpenseDoc & {
  recurringId?: string;
  generated?: boolean;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function normalizeCouchdbUrl(input: unknown): string {
  const trimmed = String(input ?? "").trim();
  if (trimmed) return trimmed;
  return String(DEFAULT_COUCHDB_URL ?? "").trim();
}

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

function padTs(ts: number): string {
  // 13 digits covers epoch milliseconds.
  return String(Math.max(0, Math.floor(ts))).padStart(13, "0");
}

function makeExpenseId(ts: number): string {
  const r = Math.random().toString(16).slice(2, 8);
  return `exp_${padTs(ts)}_${r}`;
}

function makeRecurringExpenseId(): string {
  const r = Math.random().toString(16).slice(2, 10);
  return `rexp_${r}`;
}

function makeRecurringOccurrenceId(recurringId: string, ts: number): string {
  return `recur_occ_${encodeURIComponent(recurringId)}_${padTs(ts)}`;
}

function recurringSkipId(recurringId: string, ts: number): string {
  return `rskip_${encodeURIComponent(recurringId)}_${padTs(ts)}`;
}

function parseRecurringOccurrenceId(id: string):
  | { recurringId: string; occurrenceTs: number }
  | undefined {
  const m = /^recur_occ_(.+)_(\d{13})$/.exec(String(id || ""));
  if (!m) return undefined;
  const occurrenceTs = Number(m[2]);
  if (!Number.isFinite(occurrenceTs)) return undefined;
  try {
    return {
      recurringId: decodeURIComponent(m[1]),
      occurrenceTs,
    };
  } catch {
    return undefined;
  }
}

function ym(month: number, year: number): number {
  return year * 100 + (month + 1);
}

function monthId(month: number, year: number): string {
  return `month_${ym(month, year)}`;
}

function categoryId(name: string): string {
  return `cat_${encodeURIComponent(name)}`;
}

function asValidDate(input: Date | string | number | undefined): Date | undefined {
  if (input === undefined) return undefined;
  const d = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (!Number.isFinite(d.getTime())) return undefined;
  return d;
}

function makeOccurrenceDate(
  year: number,
  month: number,
  dayOfMonth: number,
  anchor: Date,
): Date {
  const day = Math.min(dayOfMonth, getDaysInMonth(month, year));
  return new Date(
    year,
    month,
    day,
    anchor.getHours(),
    anchor.getMinutes(),
    anchor.getSeconds(),
    anchor.getMilliseconds(),
  );
}

function normalizeRecurringEndTs(
  input: Date | string | number | undefined,
  anchor: Date,
): number | undefined {
  const d = asValidDate(input);
  if (!d) return undefined;
  return makeOccurrenceDate(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    anchor,
  ).getTime();
}

function recurringExpenseOverlapsRange(
  doc: RecurringExpenseDoc,
  startTs: number,
  endTs: number,
): boolean {
  return doc.startTs <= endTs && (doc.endTs === undefined || startTs <= doc.endTs);
}

function compareRecurringExpenseDocs(
  a: RecurringExpenseDoc,
  b: RecurringExpenseDoc,
): number {
  const aEnd = a.endTs;
  const bEnd = b.endTs;

  if (aEnd === undefined && bEnd !== undefined) return -1;
  if (aEnd !== undefined && bEnd === undefined) return 1;
  if (aEnd !== undefined && bEnd !== undefined && aEnd !== bEnd) return aEnd - bEnd;
  if (a.startTs !== b.startTs) return b.startTs - a.startTs;
  return a._id.localeCompare(b._id);
}

function toRecurringExpense(doc: RecurringExpenseDoc): RecurringExpense {
  return {
    _id: doc._id,
    amount: Number(doc.cost),
    category: doc.category,
    frequency: doc.frequency,
    interval: doc.interval,
    startDate: new Date(doc.startTs),
    endDate: doc.endTs === undefined ? null : new Date(doc.endTs),
    active: doc.active,
  };
}

function monthIndex(year: number, month: number): number {
  return year * 12 + month;
}

function skipKey(recurringId: string, ts: number): string {
  return `${recurringId}:${ts}`;
}

function generateRecurringExpenseOccurrences(
  doc: RecurringExpenseDoc,
  startTs: number,
  endTs: number,
  skipped: Set<string>,
): ExpenseListDoc[] {
  if (!doc.active) return [];
  if (!Number.isFinite(doc.startTs) || doc.startTs >= endTs) return [];
  if (doc.endTs !== undefined && doc.endTs < startTs) return [];

  const out: ExpenseListDoc[] = [];
  const anchor = new Date(doc.startTs);
  const interval = Math.max(1, Math.floor(doc.interval || 1));

  if (doc.frequency === "monthly") {
    const firstMonth = monthIndex(anchor.getFullYear(), anchor.getMonth());
    const rangeMonthStart = monthIndex(
      new Date(startTs).getFullYear(),
      new Date(startTs).getMonth(),
    );
    let cursorMonth = firstMonth;
    if (rangeMonthStart > firstMonth) {
      const delta = rangeMonthStart - firstMonth;
      cursorMonth = firstMonth + Math.floor(delta / interval) * interval;
      while (cursorMonth > firstMonth) {
        const prevMonth = cursorMonth - interval;
        const prevYear = Math.floor(prevMonth / 12);
        const prevMonthOfYear = prevMonth % 12;
        const prevTs = makeOccurrenceDate(
          prevYear,
          prevMonthOfYear,
          doc.dayOfMonth,
          anchor,
        ).getTime();
        if (prevTs < startTs) break;
        cursorMonth = prevMonth;
      }
    }

    for (;;) {
      const year = Math.floor(cursorMonth / 12);
      const month = cursorMonth % 12;
      const occurrenceTs = makeOccurrenceDate(
        year,
        month,
        doc.dayOfMonth,
        anchor,
      ).getTime();
      if (occurrenceTs >= endTs) break;
      if (doc.endTs !== undefined && occurrenceTs > doc.endTs) break;
      if (
        occurrenceTs >= startTs &&
        occurrenceTs >= doc.startTs &&
        !skipped.has(skipKey(doc._id, occurrenceTs))
      ) {
        out.push({
          _id: makeRecurringOccurrenceId(doc._id, occurrenceTs),
          type: "expense",
          ts: occurrenceTs,
          cost: Number(doc.cost),
          category: doc.category,
          recurringId: doc._id,
          generated: true,
        });
      }
      cursorMonth += interval;
    }
  }

  if (doc.frequency === "yearly") {
    const startYear = anchor.getFullYear();
    const rangeStartDate = new Date(startTs);
    let year = startYear;
    if (rangeStartDate.getFullYear() > startYear) {
      const delta = rangeStartDate.getFullYear() - startYear;
      year = startYear + Math.floor(delta / interval) * interval;
      while (year > startYear) {
        const prevTs = makeOccurrenceDate(
          year - interval,
          doc.monthOfYear ?? anchor.getMonth(),
          doc.dayOfMonth,
          anchor,
        ).getTime();
        if (prevTs < startTs) break;
        year -= interval;
      }
    }

    for (;;) {
      const occurrenceTs = makeOccurrenceDate(
        year,
        doc.monthOfYear ?? anchor.getMonth(),
        doc.dayOfMonth,
        anchor,
      ).getTime();
      if (occurrenceTs >= endTs) break;
      if (doc.endTs !== undefined && occurrenceTs > doc.endTs) break;
      if (
        occurrenceTs >= startTs &&
        occurrenceTs >= doc.startTs &&
        !skipped.has(skipKey(doc._id, occurrenceTs))
      ) {
        out.push({
          _id: makeRecurringOccurrenceId(doc._id, occurrenceTs),
          type: "expense",
          ts: occurrenceTs,
          cost: Number(doc.cost),
          category: doc.category,
          recurringId: doc._id,
          generated: true,
        });
      }
      year += interval;
    }
  }

  return out;
}

type LegacySpendingItem = {
  category?: unknown;
  cost?: unknown;
  date?: unknown;
};

function isRecord(x: unknown): x is Record<string, any> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function asFiniteNumber(x: unknown): number | undefined {
  const n = typeof x === "number" ? x : Number(x);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function parseIsoTs(x: unknown): number | undefined {
  const s = String(x ?? "").trim();
  if (!s) return undefined;
  const ts = Date.parse(s);
  if (!Number.isFinite(ts)) return undefined;
  return ts;
}

function decodeBase64Utf8(data: unknown): string | undefined {
  const b64 = String(data ?? "").trim();
  if (!b64) return undefined;

  try {
    // Prefer atob + TextDecoder for proper UTF-8 handling.
    const bin = typeof atob === "function" ? atob(b64) : undefined;
    if (bin === undefined) return undefined;
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (typeof TextDecoder !== "undefined") {
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    }
    // Fallback: best-effort (works for ASCII JSON).
    return bin;
  } catch {
    return undefined;
  }
}

function legacyDocsDebugStats(docs: any[]): Record<string, any> {
  const counts: Record<string, number> = {};
  let minTs: number | undefined;
  let maxTs: number | undefined;
  const cats = new Set<string>();
  for (const d of docs) {
    const t = String((d as any)?.type ?? "unknown");
    counts[t] = (counts[t] || 0) + 1;
    if (t === "expense") {
      const ts = (d as any)?.ts;
      if (typeof ts === "number" && Number.isFinite(ts)) {
        minTs = minTs === undefined ? ts : Math.min(minTs, ts);
        maxTs = maxTs === undefined ? ts : Math.max(maxTs, ts);
      }
      const c = String((d as any)?.category ?? "").trim();
      if (c) cats.add(c);
    }
    if (t === "category") {
      const c = String((d as any)?.name ?? "").trim();
      if (c) cats.add(c);
    }
  }

  return {
    total: docs.length,
    counts,
    uniqueCategories: cats.size,
    minExpenseIso: minTs ? new Date(minTs).toISOString() : undefined,
    maxExpenseIso: maxTs ? new Date(maxTs).toISOString() : undefined,
  };
}

export function legacyToDocs(input: unknown): any[] {
  if (!isRecord(input)) return [];

  const buckets: {
    month: number;
    year: number;
    dailyBudget: number;
    spending: LegacySpendingItem[];
  }[] = [];

  for (const v of Object.values(input) as any[]) {
    if (!isRecord(v)) continue;
    const month = Number(v.month);
    const year = Number(v.year);
    const spending = Array.isArray(v.spending) ? (v.spending as any[]) : null;

    if (!Number.isInteger(month) || month < 0 || month > 11) continue;
    if (!Number.isInteger(year) || year < 2000 || year > 3000) continue;
    if (!spending) continue;

    const dailyBudget = asFiniteNumber(v.daily_budget) ?? 0;
    buckets.push({
      month,
      year,
      dailyBudget,
      spending: spending.filter(isRecord) as any,
    });
  }

  buckets.sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month));
  const lastBucket = buckets.length > 0 ? buckets[buckets.length - 1] : undefined;

  const categoriesSeen: string[] = [];
  const categoriesSet = new Set<string>();
  for (const b of buckets) {
    for (const it of b.spending) {
      const name = String((it as any)?.category ?? "").trim();
      if (!name) continue;
      if (categoriesSet.has(name)) continue;
      categoriesSet.add(name);
      categoriesSeen.push(name);
    }
  }

  const categoryNames =
    categoriesSeen.length > 0 ? categoriesSeen : [...DEFAULT_CATEGORIES];

  const settingsBudgetDaily =
    (lastBucket ? asFiniteNumber(lastBucket.dailyBudget) : undefined) ??
    (isRecord((input as any).settings)
      ? asFiniteNumber((input as any).settings.daily_budget)
      : undefined) ??
    0;

  const docs: any[] = [];

  const settings: SettingsDoc = {
    _id: "settings",
    type: "settings",
    currency: DEFAULT_CURRENCY,
    language: DEFAULT_LANGUAGE,
    couchdbURL: normalizeCouchdbUrl(""),
    budget: { type: BudgetType.Daily, budget: round2(settingsBudgetDaily) },
    lastUpdate: currentVersion,
  };
  docs.push(settings);

  for (const name of categoryNames) {
    const d: CategoryDoc = {
      _id: categoryId(name),
      type: "category",
      name,
    };
    docs.push(d);
  }

  for (const b of buckets) {
    const d: MonthDoc = {
      _id: monthId(b.month, b.year),
      type: "month",
      month: b.month,
      year: b.year,
      budget: { type: BudgetType.Daily, budget: round2(b.dailyBudget) },
    };
    docs.push(d);
  }

  for (const b of buckets) {
    for (const it of b.spending) {
      const category = String((it as any)?.category ?? "").trim();
      if (!category) continue;
      const ts = parseIsoTs((it as any)?.date);
      if (ts === undefined) continue;
      const cost = asFiniteNumber((it as any)?.cost);
      if (cost === undefined) continue;

      const d: ExpenseDoc = {
        _id: makeExpenseId(ts),
        type: "expense",
        ts,
        cost: round2(cost),
        category,
      };
      docs.push(d);
    }
  }

  return docs;
}

function getFormattedMonthLabel(date: Date, language: string): string {
  if (language === "en") {
    const n = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${n[date.getMonth()]} ${date.getFullYear()}`;
  }
  const n = [
    "Gennaio",
    "Febbraio",
    "Marzo",
    "Aprile",
    "Maggio",
    "Giugno",
    "Luglio",
    "Agosto",
    "Settembre",
    "Ottobre",
    "Novembre",
    "Dicembre",
  ];
  return `${n[date.getMonth()]} ${date.getFullYear()}`;
}

function dailyBudgetFrom(budget: Budget, month: number, year: number): number {
  if (budget.type === BudgetType.Daily) return Number(budget.budget) || 0;
  const b = Number(budget.budget) || 0;
  return round2(b / getDaysInMonth(month, year));
}

async function safeGet<T>(db: any, id: string): Promise<T | undefined> {
  try {
    return (await db.get(id)) as any;
  } catch (e: any) {
    if (e && e.status === 404) return undefined;
    throw e;
  }
}

async function putIfMissing(db: any, doc: any): Promise<boolean> {
  const existing = await safeGet<any>(db, doc._id);
  if (existing) return false;
  await db.put(doc);
  return true;
}

let cordovaSqliteRegistered = false;

async function openDb(dbName: string, platform: string) {
  if (platform === "android") {
    try {
      if (!cordovaSqliteRegistered) {
        const mod: any = await import("pouchdb-adapter-cordova-sqlite");
        PouchDB.plugin(mod?.default ?? mod);
        cordovaSqliteRegistered = true;
      }
      try {
        const db = new PouchDB(dbName, {
          adapter: "cordova-sqlite",
          // Required by cordova-sqlite-storage.
          location: "default",
          // Cannot have both defined
          // iosDatabaseLocation: 'Library',
        });
        // Ensure the adapter actually opened successfully; some failures surface during setup.
        await db.info();
        logger.info(`[db] opened adapter=cordova-sqlite name=${dbName}`);
        return db;
      } catch (e) {
        logger.warn("[db] sqlite failed, falling back", e);
      }
    } catch (e) {
      logger.warn("[db] sqlite adapter load failed, falling back", e);
    }
  }
  const db = new PouchDB(dbName);
  if (platform === "android") {
    logger.info(`[db] opened adapter=fallback name=${dbName}`);
  }
  return db;
}

function syncBackoff(delay: number) {
  const base = delay === 0 ? 1000 : Math.min(delay * 2, 5 * 60 * 1000);
  const jitter = base * 0.2 * (Math.random() * 2 - 1);
  return Math.max(1000, Math.round(base + jitter));
}

export function createModel(defaultDbName = "spending-management") {
  return {
    isInit: false,
    initPromise: undefined as Promise<boolean> | undefined,
    dbName: defaultDbName,
    platform: "web" as string,
    db: undefined as any,
    settings: undefined as SettingsDoc | undefined,
    categories: [] as string[],
    weekly_exp: undefined as Expense | undefined,
    monthly_exp: undefined as Expense | undefined,

    syncHandler: undefined as any,
    _onlineListener: undefined as any,
    _appStateListener: undefined as any,
    _hooksSetup: false,
    _syncWanted: false,
    _syncUrl: "",

    async init(opts?: {
      dbName?: string;
      platform?: string;
    }): Promise<boolean> {
      if (this.isInit) return true;
      if (this.initPromise) return await this.initPromise;

      this.initPromise = (async () => {
        if (opts?.dbName) this.dbName = opts.dbName;
        this.platform = opts?.platform ?? Capacitor.getPlatform();
        this.db = await openDb(this.dbName, this.platform);

        const existingSettings = await safeGet<SettingsDoc>(
          this.db,
          "settings",
        );
        if (!existingSettings) {
          const settings: SettingsDoc = {
            _id: "settings",
            type: "settings",
            currency: DEFAULT_CURRENCY,
            language: DEFAULT_LANGUAGE,
            couchdbURL: normalizeCouchdbUrl(""),
            budget: { ...DEFAULT_BUDGET },
            lastUpdate: currentVersion,
          };
          try {
            await this.db.put(settings);
            this.settings = settings;
          } catch (e: any) {
            if (!(e && e.status === 409)) throw e;
            const current = await safeGet<SettingsDoc>(this.db, "settings");
            if (!current) throw e;
            this.settings = current;
          }

          for (const name of DEFAULT_CATEGORIES) {
            const d: CategoryDoc = {
              _id: categoryId(name),
              type: "category",
              name,
            };
            await putIfMissing(this.db, d);
          }

          this.categories = [...DEFAULT_CATEGORIES];

          this.isInit = true;

          this._setupSyncHooks();
          await this._restartSync();
          return false;
        }

        // Normalize CouchDB URL: empty => DEFAULT_COUCHDB_URL.
        // Note: this intentionally removes the ability to disable sync by clearing the URL.
        const normalizedSettings: any = { ...existingSettings };
        const normalizedUrl = normalizeCouchdbUrl(normalizedSettings.couchdbURL);
        const needsSettingsWrite = normalizedSettings.couchdbURL !== normalizedUrl;
        if (needsSettingsWrite) {
          normalizedSettings.couchdbURL = normalizedUrl;
          try {
            const current = (await this.db.get("settings")) as any;
            current.couchdbURL = normalizedUrl;
            current.lastUpdate = currentVersion;
            await this.db.put(current);
            this.settings = current;
          } catch (e) {
            logger.warn("[settings] failed to persist couchdbURL normalization", e);
            this.settings = normalizedSettings;
          }
        } else {
          this.settings = existingSettings;
        }

        // Load categories into an in-memory cache so the UI can keep sync access.
        const catsRes = await this.db.allDocs({
          include_docs: true,
          startkey: "cat_",
          endkey: "cat_\uffff",
        });
        this.categories = catsRes.rows
          .map((r: any) => (r.doc as any)?.name)
          .filter((n: any): n is string => typeof n === "string");

        this.isInit = true;

        this._setupSyncHooks();
        await this._restartSync();
        return true;
      })();

      try {
        return await this.initPromise;
      } finally {
        this.initPromise = undefined;
      }
    },

    _setupSyncHooks() {
      if (this._hooksSetup) return;
      this._hooksSetup = true;

      this._onlineListener = () => {
        if (this._syncWanted) {
          this._restartSync().catch(() => {});
        }
      };
      window.addEventListener("online", this._onlineListener);

      try {
        this._appStateListener = App.addListener("appStateChange", (state) => {
          if (!this._syncWanted) return;
          if (state.isActive) {
            this._restartSync().catch(() => {});
          } else {
            this._stopSync("background");
          }
        });
      } catch {
        // Web: App plugin may not be available; ignore.
      }
    },

    _stopSync(reason?: string) {
      if (this.syncHandler && typeof this.syncHandler.cancel === "function") {
        try {
          this.syncHandler.cancel();
          logger.info("[sync] stop", { reason: reason || "cancel" });
        } catch {
          // ignore
        }
      }
      this.syncHandler = undefined;
    },

    async _restartSync() {
      await this.ensureInit();

      const url = normalizeCouchdbUrl(this.settings!.couchdbURL);
      const prevWanted = this._syncWanted;
      const prevUrl = this._syncUrl;
      this._syncUrl = url;
      this._syncWanted = url.length > 0;

      this._stopSync("restart");
      if (!this._syncWanted) {
        if (prevWanted) {
          logger.info("[sync] stop", { reason: "disabled" });
        }
        return;
      }

      try {
        logger.info(prevWanted ? "[sync] restart" : "[sync] start", {
          url,
          sameUrl: prevWanted && prevUrl === url,
        });
        const h = this.db!.sync(url, {
          live: true,
          retry: true,
          back_off_function: syncBackoff,
        });

        const authHint = (err: any) => {
          const st = err?.status;
          if (st === 401 || st === 403) {
            return "CouchDB requires auth; try https://user:pass@host:5984/db or adjust CouchDB security.";
          }
          return undefined;
        };

        h.on("denied", (err: any) =>
          logger.warn("[sync] denied", {
            status: err?.status,
            name: err?.name,
            message: err?.message,
            hint: authHint(err),
          }),
        );
        h.on("error", (err: any) =>
          logger.warn("[sync] error", {
            status: err?.status,
            name: err?.name,
            message: err?.message,
            hint: authHint(err),
          }),
        );
        h.on("paused", (err: any) => {
          if (err)
            logger.info("[sync] paused", {
              status: err?.status,
              name: err?.name,
              message: err?.message,
              hint: authHint(err),
            });
        });
        this.syncHandler = h;
      } catch (e) {
        logger.warn("[sync] failed to start", e);
      }
    },

    async ensureInit() {
      if (!this.isInit) {
        await this.init();
      }
      if (!this.db || !this.settings) {
        throw new Error("model not initialized");
      }
    },

    async ensureMonthDoc(month: number, year: number): Promise<MonthDoc> {
      await this.ensureInit();
      const id = monthId(month, year);
      const existing = await safeGet<MonthDoc>(this.db!, id);
      if (existing) return existing;

      const doc: MonthDoc = {
        _id: id,
        type: "month",
        month,
        year,
        budget: {
          type: this.settings!.budget.type,
          budget: this.settings!.budget.budget,
        },
      };
      await this.db!.put(doc);
      return doc;
    },

    async getExpenseDocsInRange(
      startTs: number,
      endTs: number,
    ): Promise<ExpenseDoc[]> {
      await this.ensureInit();
      const startkey = `exp_${padTs(startTs)}`;
      const endkey = `exp_${padTs(endTs)}\uffff`;

      const res = await this.db!.allDocs({
        include_docs: true,
        startkey,
        endkey,
      });

      const docs: ExpenseDoc[] = [];
      for (const row of res.rows) {
        const d: any = row.doc;
        if (!d || d.type !== "expense") continue;
        if (typeof d.ts !== "number") continue;
        if (d.ts < startTs || d.ts >= endTs) continue;
        docs.push(d as ExpenseDoc);
      }

      docs.sort((a, b) => a.ts - b.ts);
      return docs;
    },

    async getRecurringExpenseDocs(): Promise<RecurringExpenseDoc[]> {
      await this.ensureInit();
      const res = await this.db!.allDocs({
        include_docs: true,
        startkey: "rexp_",
        endkey: "rexp_\uffff",
      });

      const docs: RecurringExpenseDoc[] = [];
      for (const row of res.rows) {
        const d: any = row.doc;
        if (!d || d.type !== "recurring_expense") continue;
        docs.push(d as RecurringExpenseDoc);
      }
      return docs;
    },

    async list_all_recurring_expenses(): Promise<RecurringExpense[]> {
      const docs = await this.getRecurringExpenseDocs();
      docs.sort(compareRecurringExpenseDocs);
      return docs.map(toRecurringExpense);
    },

    async list_recurring_expenses(
      input: ListRecurringExpensesInput,
    ): Promise<RecurringExpense[]> {
      const startDate = asValidDate(input?.start);
      const endDate = asValidDate(input?.end);
      if (!startDate || !endDate) return [];

      const startTs = startDate.getTime();
      const endTs = endDate.getTime();
      if (startTs > endTs) return [];

      const docs = await this.getRecurringExpenseDocs();
      return docs
        .filter((doc) => recurringExpenseOverlapsRange(doc, startTs, endTs))
        .sort(compareRecurringExpenseDocs)
        .map(toRecurringExpense);
    },

    async getRecurringSkipSetInRange(
      startTs: number,
      endTs: number,
    ): Promise<Set<string>> {
      await this.ensureInit();
      const res = await this.db!.allDocs({
        include_docs: true,
        startkey: "rskip_",
        endkey: "rskip_\uffff",
      });

      const skipped = new Set<string>();
      for (const row of res.rows) {
        const d: any = row.doc;
        if (!d || d.type !== "recurring_skip") continue;
        if (typeof d.occurrenceTs !== "number") continue;
        if (d.occurrenceTs < startTs || d.occurrenceTs >= endTs) continue;
        skipped.add(skipKey(String(d.recurringId), d.occurrenceTs));
      }
      return skipped;
    },

    async getRecurringSkipDocs(recurringId: string): Promise<RecurringSkipDoc[]> {
      await this.ensureInit();
      const encodedId = encodeURIComponent(String(recurringId));
      const res = await this.db!.allDocs({
        include_docs: true,
        startkey: `rskip_${encodedId}_`,
        endkey: `rskip_${encodedId}_\uffff`,
      });

      const docs: RecurringSkipDoc[] = [];
      for (const row of res.rows) {
        const d: any = row.doc;
        if (!d || d.type !== "recurring_skip") continue;
        if (d.recurringId !== recurringId) continue;
        docs.push(d as RecurringSkipDoc);
      }
      return docs;
    },

    async getAllExpenseDocsInRange(
      startTs: number,
      endTs: number,
    ): Promise<ExpenseListDoc[]> {
      const docs = (await this.getExpenseDocsInRange(startTs, endTs)) as ExpenseListDoc[];
      const recurringDocs = await this.getRecurringExpenseDocs();
      if (recurringDocs.length === 0) return docs;

      const skipped = await this.getRecurringSkipSetInRange(startTs, endTs);
      for (const recurring of recurringDocs) {
        const generated = generateRecurringExpenseOccurrences(
          recurring,
          startTs,
          endTs,
          skipped,
        );
        docs.push(...generated);
      }

      docs.sort((a, b) => a.ts - b.ts);
      return docs;
    },

    // UI helpers
    get_empty_expense(): Expense {
      return {
        total_sum: "0.00",
        max_budget: "0.00",
        remains: "0.00",
        budget_as_today: "0.00",
      };
    },

    // Settings
    get_budget(): Budget {
      return this.settings!.budget;
    },

    async set_budget(type: number, budget: number) {
      await this.ensureInit();
      this.weekly_exp = undefined;
      this.monthly_exp = undefined;

      const t: BudgetType =
        type === BudgetType.Daily ? BudgetType.Daily : BudgetType.Monthly;
      this.settings!.budget.type = t;
      this.settings!.budget.budget = budget;

      const current = (await this.db!.get("settings")) as any;
      current.budget = { type: t, budget };
      current.lastUpdate = currentVersion;
      await this.db!.put(current);
      this.settings = current;

      // Apply to current month doc.
      const now = new Date(Date.now());
      const m = await this.ensureMonthDoc(now.getMonth(), now.getFullYear());
      const fresh = (await this.db!.get(m._id)) as any;
      fresh.budget = { type: t, budget };
      await this.db!.put(fresh);
    },

    get_categories(): string[] {
      return this.categories;
    },

    add_category(category: string): boolean {
      const name = String(category || "").trim();
      if (!name) return false;
      if (this.categories.includes(name)) return false;
      this.categories.push(name);

      // Persist async (UI keeps the old sync API).
      (async () => {
        await this.ensureInit();
        const id = categoryId(name);
        const existing = await safeGet<any>(this.db!, id);
        if (existing) return;
        const doc: CategoryDoc = { _id: id, type: "category", name };
        await this.db!.put(doc);
      })().catch(() => {
        // Ignore persistence errors to preserve sync API.
      });

      return true;
    },

    remove_category(category: string) {
      const name = String(category || "").trim();
      if (!name) return;
      this.categories = this.categories.filter((x) => x !== name);
      (async () => {
        await this.ensureInit();
        const id = categoryId(name);
        const d = await safeGet<any>(this.db!, id);
        if (!d) return;
        await this.db!.remove(d);
      })().catch(() => {
        // Ignore persistence errors to preserve sync API.
      });
    },

    get_default_value(): string {
      return this.settings!.currency;
    },

    get_couchdb_url(): string {
      return normalizeCouchdbUrl(this.settings!.couchdbURL);
    },

    async set_couchdb_url(url: string) {
      await this.ensureInit();
      const v = normalizeCouchdbUrl(url);
      this.settings!.couchdbURL = v;
      try {
        const current = (await this.db!.get("settings")) as any;
        current.couchdbURL = v;
        current.lastUpdate = currentVersion;
        await this.db!.put(current);
        this.settings = current;
      } catch (e) {
        logger.warn("[settings] failed to persist couchdbURL", e);
      }
      await this._restartSync();
    },

    set_default_value(value: string) {
      // Keep the old sync API and persist best-effort.
      if (this.settings) this.settings.currency = value;
      (async () => {
        await this.ensureInit();
        this.settings!.currency = value;
        const current = (await this.db!.get("settings")) as any;
        current.currency = value;
        current.lastUpdate = currentVersion;
        await this.db!.put(current);
        this.settings = current;
      })().catch(() => {
        // Ignore persistence errors to preserve sync API.
      });
    },

    // Expenses
    async add_expense(amount: number, category: string) {
      await this.ensureInit();
      this.weekly_exp = undefined;
      this.monthly_exp = undefined;

      const now = new Date(Date.now());
      await this.ensureMonthDoc(now.getMonth(), now.getFullYear());

      const ts = now.getTime();
      const doc: ExpenseDoc = {
        _id: makeExpenseId(ts),
        type: "expense",
        ts,
        cost: Number(amount),
        category: String(category),
      };
      await this.db!.put(doc);
    },

    async add_recurring_expense(
      input: AddRecurringExpenseInput,
    ): Promise<boolean> {
      await this.ensureInit();

      const category = String(input?.category || "").trim();
      const frequency = input?.frequency;
      const amount = Number(input?.amount);
      const interval = Math.max(1, Math.floor(Number(input?.interval ?? 1)));
      const startDate =
        asValidDate(input?.startDate) ?? new Date(Date.now());
      const endTs = normalizeRecurringEndTs(input?.endDate, startDate);

      if (!category) return false;
      if (!Number.isFinite(amount)) return false;
      if (frequency !== "monthly" && frequency !== "yearly") return false;
      if (input?.endDate !== undefined && endTs === undefined) return false;
      if (endTs !== undefined && endTs < startDate.getTime()) return false;

      const doc: RecurringExpenseDoc = {
        _id: makeRecurringExpenseId(),
        type: "recurring_expense",
        cost: round2(amount),
        category,
        startTs: startDate.getTime(),
        endTs,
        frequency,
        interval,
        dayOfMonth: startDate.getDate(),
        monthOfYear: frequency === "yearly" ? startDate.getMonth() : undefined,
        active: true,
      };

      this.weekly_exp = undefined;
      this.monthly_exp = undefined;
      await this.db!.put(doc);
      return true;
    },

    async remove_recurring_expense(recurringId: string): Promise<boolean> {
      await this.ensureInit();
      const id = String(recurringId || "").trim();
      if (!id) return false;

      this.weekly_exp = undefined;
      this.monthly_exp = undefined;

      const recurringDoc = await safeGet<any>(this.db!, id);
      if (!recurringDoc || recurringDoc.type !== "recurring_expense") return false;

      const skipDocs = await this.getRecurringSkipDocs(id);
      if (skipDocs.length > 0) {
        await this.db!.bulkDocs(
          skipDocs.map((doc) => ({
            ...doc,
            _deleted: true,
          })),
        );
      }

      await this.db!.remove(recurringDoc);
      return true;
    },

    async update_recurring_expense_end_date(
      recurringId: string,
      endDate: Date | string | number | null | undefined,
    ): Promise<boolean> {
      await this.ensureInit();

      const id = String(recurringId || "").trim();
      if (!id) return false;

      const recurringDoc = await safeGet<any>(this.db!, id);
      if (!recurringDoc || recurringDoc.type !== "recurring_expense") return false;

      const anchor = new Date(recurringDoc.startTs);
      const normalizedEndTs =
        endDate == null ? undefined : normalizeRecurringEndTs(endDate, anchor);
      if (endDate != null && normalizedEndTs === undefined) return false;
      if (
        normalizedEndTs !== undefined &&
        normalizedEndTs < Number(recurringDoc.startTs)
      ) {
        return false;
      }

      this.weekly_exp = undefined;
      this.monthly_exp = undefined;

      const nextDoc: RecurringExpenseDoc = {
        ...recurringDoc,
        endTs: normalizedEndTs,
        active: true,
      };

      if (normalizedEndTs === undefined) {
        delete nextDoc.endTs;
      }

      await this.db!.put(nextDoc as any);
      return true;
    },

    async remove_expense(expense: SingleExpense) {
      await this.ensureInit();
      this.weekly_exp = undefined;
      this.monthly_exp = undefined;

      const anyExp: any = expense as any;
      const id =
        anyExp && typeof anyExp._id === "string" ? anyExp._id : undefined;
      if (id && id.startsWith("recur_occ_")) {
        const parsed = parseRecurringOccurrenceId(id);
        if (!parsed) return;
        const skipDoc: RecurringSkipDoc = {
          _id: recurringSkipId(parsed.recurringId, parsed.occurrenceTs),
          type: "recurring_skip",
          recurringId: parsed.recurringId,
          occurrenceTs: parsed.occurrenceTs,
        };
        await putIfMissing(this.db!, skipDoc);
        return;
      }
      if (id && id.startsWith("exp_")) {
        const d = await safeGet<any>(this.db!, id);
        if (d) {
          await this.db!.remove(d);
          return;
        }
      }

      // Fallback: best-effort match by (ts, cost, category) within the expense's month.
      const dt =
        expense.date instanceof Date
          ? expense.date
          : new Date(expense.date as any);
      const month = dt.getMonth();
      const year = dt.getFullYear();
      const start = new Date(year, month, 1).getTime();
      const end = new Date(year, month + 1, 1).getTime();
      const docs = await this.getExpenseDocsInRange(start, end);
      const targetTs = dt.getTime();
      const targetCost = round2(Number((expense as any).cost));
      const targetCat = expense.category;
      for (const d of docs) {
        if (d.category !== targetCat) continue;
        if (round2(Number(d.cost)) !== targetCost) continue;
        if (d.ts !== targetTs) continue;
        const full = await safeGet<any>(this.db!, d._id);
        if (full) {
          await this.db!.remove(full);
          return;
        }
      }
    },

    async get_all_month_expenses(
      _month = "" as any,
      _year = "" as any,
    ): Promise<SingleExpense[]> {
      await this.ensureInit();
      const now = new Date(Date.now());
      const month =
        _month === "" || _year === "" ? now.getMonth() : Number(_month);
      const year =
        _month === "" || _year === "" ? now.getFullYear() : Number(_year);

      await this.ensureMonthDoc(month, year);
      const start = new Date(year, month, 1).getTime();
      const end = new Date(year, month + 1, 1).getTime();
      const docs = await this.getAllExpenseDocsInRange(start, end);

      const out: any[] = docs.map((d) => ({
        _id: d._id,
        cost: round2(Number(d.cost)).toFixed(2),
        date: new Date(d.ts),
        category: d.category,
      }));
      return out as any;
    },

    async get_expenses_by_category(
      _month = "" as any,
      _year = "" as any,
    ): Promise<any[]> {
      await this.ensureInit();
      const now = new Date(Date.now());
      const month =
        _month === "" || _year === "" ? now.getMonth() : Number(_month);
      const year =
        _month === "" || _year === "" ? now.getFullYear() : Number(_year);

      const expenses = await this.get_all_month_expenses(
        month as any,
        year as any,
      );
      const d: Record<string, number> = {};
      for (const e of expenses as any[]) {
        const cat = e.category;
        const cost = Number(e.cost);
        d[cat] = (d[cat] || 0) + cost;
      }
      const a: any[] = [];
      for (const k of Object.keys(d)) {
        a.push([k, d[k].toFixed(2)]);
      }
      a.sort((x: any, y: any) => Number(y[1]) - Number(x[1]));
      return a;
    },

    async get_monthly_expense(
      _month = "" as any,
      _year = "" as any,
    ): Promise<Expense> {
      await this.ensureInit();
      const now = new Date(Date.now());
      const isCurrent = _month === "" || _year === "";
      const month = isCurrent ? now.getMonth() : Number(_month);
      const year = isCurrent ? now.getFullYear() : Number(_year);

      if (isCurrent && this.monthly_exp) return this.monthly_exp;

      const md = await this.ensureMonthDoc(month, year);
      const daily = dailyBudgetFrom(md.budget, month, year);
      const days = getDaysInMonth(month, year);
      const maxBudget = daily * days;

      const start = new Date(year, month, 1).getTime();
      const end = new Date(year, month + 1, 1).getTime();
      const docs = await this.getAllExpenseDocsInRange(start, end);
      const tot = docs.reduce((s, d) => s + Number(d.cost), 0);

      if (isCurrent) {
        const budgetAsToday = daily * now.getDate();
        const exp: Expense = {
          total_sum: tot.toFixed(2),
          max_budget: maxBudget.toFixed(2),
          remains: (budgetAsToday - tot).toFixed(2),
          budget_as_today: budgetAsToday.toFixed(2),
        };
        this.monthly_exp = exp;
        return exp;
      }

      const exp: Expense = {
        total_sum: tot.toFixed(2),
        max_budget: maxBudget.toFixed(2),
        remains: (maxBudget - tot).toFixed(2),
        budget_as_today: maxBudget.toFixed(2),
      };
      return exp;
    },

    async get_weekly_expense(): Promise<Expense> {
      await this.ensureInit();
      if (this.weekly_exp) return this.weekly_exp;

      const now = new Date(Date.now());
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const md = await this.ensureMonthDoc(currentMonth, currentYear);
      const daily = dailyBudgetFrom(md.budget, currentMonth, currentYear);

      let dayOfWeek = now.getDay() - 1;
      if (dayOfWeek === -1) dayOfWeek = 6;
      const startOfWeek = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - dayOfWeek,
      );
      const startTs = startOfWeek.getTime();
      const endTs = now.getTime() + 1;

      const docs = await this.getAllExpenseDocsInRange(startTs, endTs);
      const weekSpending = docs.reduce((s, d) => s + Number(d.cost), 0);

      const exp: Expense = {
        total_sum: weekSpending.toFixed(2),
        max_budget: (daily * 7).toFixed(2),
        remains: (daily * (dayOfWeek + 1) - weekSpending).toFixed(2),
        budget_as_today: (daily * (dayOfWeek + 1)).toFixed(2),
      };
      this.weekly_exp = exp;
      return exp;
    },

    async get_past_monthly_expenses(
      n_months: number,
    ): Promise<ExpenseWithDate[]> {
      await this.ensureInit();
      const now = new Date(Date.now());
      const months: { month: number; year: number; dateObj: Date }[] = [];
      const cursor = new Date(now.getFullYear(), now.getMonth(), 1);

      for (let i = 0; i < n_months; i++) {
        const m = cursor.getMonth();
        const y = cursor.getFullYear();
        months.push({ month: m, year: y, dateObj: new Date(y, m, 14) });
        cursor.setMonth(cursor.getMonth() - 1);
      }

      // Ensure month docs exist.
      for (const m of months) {
        await this.ensureMonthDoc(m.month, m.year);
      }

      // Query expenses for the full range once.
      const oldest = months[months.length - 1];
      const rangeStart = new Date(oldest.year, oldest.month, 1).getTime();
      const rangeEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1,
      ).getTime();
      const docs = await this.getAllExpenseDocsInRange(rangeStart, rangeEnd);

      const totals: Record<string, number> = {};
      for (const d of docs) {
        const dt = new Date(d.ts);
        const key = monthId(dt.getMonth(), dt.getFullYear());
        totals[key] = (totals[key] || 0) + Number(d.cost);
      }

      const out: ExpenseWithDate[] = [];
      for (const m of months) {
        const id = monthId(m.month, m.year);
        const md = (await this.db!.get(id)) as any as MonthDoc;
        const daily = dailyBudgetFrom(md.budget, m.month, m.year);
        const maxBudget = daily * getDaysInMonth(m.month, m.year);
        const tot = totals[id] || 0;
        out.push({
          total_sum: tot.toFixed(2),
          remains: maxBudget - tot,
          date: getFormattedMonthLabel(m.dateObj, this.settings!.language),
          month: m.month,
          year: m.year,
        });
      }
      return out;
    },

    async export_data(): Promise<boolean> {
      await this.ensureInit();
      const res = await this.db!.allDocs({ include_docs: true });
      const docs = res.rows.map((r: any) => r.doc).filter(Boolean);
      const payload = JSON.stringify({ schema: currentVersion, docs });

      const uri = await Filesystem.writeFile({
        path: "spending_manager_export.json",
        data: payload,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      if (!uri || !(uri as any).uri) return false;
      await Share.share({
        title: "spending_manager_export.json",
        url: (uri as any).uri,
        dialogTitle: "Save exported file",
      });
      return true;
    },

    async import_data(): Promise<boolean> {
      await this.ensureInit();
      let selectedFile: any;
      try {
        selectedFile = await FilePicker.pickFiles({ readData: true } as any);
      } catch {
        return false;
      }

      const file = selectedFile?.files?.[0];
      const path = file?.path;
      const data = file?.data;
      if (!path && !data) return false;

      let obj: any;
      try {
        let text = "";
        if (path) {
          const blob = await fetch(path).then((r) => r.blob());
          text = await blob.text();
        } else {
          text = decodeBase64Utf8(data) ?? "";
        }
        obj = JSON.parse(text);
      } catch {
        return false;
      }

      const docs: any[] = Array.isArray(obj?.docs) ? obj.docs : [];
      if (!Array.isArray(docs)) return false;

      // Replace DB contents entirely.
      const dbName = this.dbName;
      await this.db!.destroy();
      this.db = await openDb(dbName, this.platform);
      this.isInit = true;

      const cleaned = docs
        .filter((d) => d && typeof d._id === "string")
        .map((d) => {
          const c = { ...d };
          delete (c as any)._rev;
          return c;
        });

      if (cleaned.length > 0) {
        await this.db.bulkDocs(cleaned);
      }

      this.settings = await safeGet<SettingsDoc>(this.db, "settings");
      if (!this.settings) {
        // If import didn't include settings, re-seed minimal settings.
        const settings: SettingsDoc = {
          _id: "settings",
          type: "settings",
          currency: DEFAULT_CURRENCY,
          language: DEFAULT_LANGUAGE,
          couchdbURL: normalizeCouchdbUrl(""),
          budget: { ...DEFAULT_BUDGET },
          lastUpdate: currentVersion,
        };
        await this.db.put(settings);
        this.settings = settings;
      }

      const catsRes = await this.db.allDocs({
        include_docs: true,
        startkey: "cat_",
        endkey: "cat_\uffff",
      });
      this.categories = catsRes.rows
        .map((r: any) => (r.doc as any)?.name)
        .filter((n: any): n is string => typeof n === "string");

      this.weekly_exp = undefined;
      this.monthly_exp = undefined;

      await this._restartSync();
      return true;
    },

    async import_legacy_data(): Promise<boolean> {
      await this.ensureInit();
      let selectedFile: any;
      try {
        selectedFile = await FilePicker.pickFiles({ readData: true } as any);
      } catch (e) {
        logger.warn("[import_legacy] file picker failed", e);
        return false;
      }
      const file = selectedFile?.files?.[0];
      const path = file?.path;
      const data = file?.data;
      if (!path && !data) {
        logger.warn("[import_legacy] missing selected file payload", {
          files: Array.isArray(selectedFile?.files)
            ? selectedFile.files.map((f: any) => ({
                name: f?.name,
                path: f?.path,
                hasData: typeof f?.data === "string" && f.data.length > 0,
                mimeType: f?.mimeType,
                size: f?.size,
              }))
            : selectedFile?.files,
        });
        return false;
      }
      logger.info("[import_legacy] selected file", {
        hasPath: Boolean(path),
        hasData: typeof data === "string" && data.length > 0,
      });

      let obj: any;
      try {
        let text = "";
        if (path) {
          const resp = await fetch(path);
          logger.info("[import_legacy] fetch ok", {
            status: (resp as any)?.status,
            ok: (resp as any)?.ok,
          });
          const blob = await resp.blob();
          text = await blob.text();
        } else {
          text = decodeBase64Utf8(data) ?? "";
          logger.info("[import_legacy] decoded file data", { bytes: text.length });
        }
        obj = JSON.parse(text);
      } catch (e) {
        logger.warn("[import_legacy] failed to read/parse JSON", e);
        return false;
      }

      const docs = legacyToDocs(obj);
      if (!Array.isArray(docs) || docs.length === 0) {
        logger.warn("[import_legacy] conversion produced no docs", {
          inputType: typeof obj,
          isArray: Array.isArray(obj),
          keys: isRecord(obj) ? Object.keys(obj).slice(0, 20) : undefined,
        });
        return false;
      }
      logger.info("[import_legacy] converted legacy docs", legacyDocsDebugStats(docs));

      // Replace DB contents entirely.
      const dbName = this.dbName;
      try {
        await this.db!.destroy();
      } catch (e) {
        logger.warn("[import_legacy] failed to destroy existing db", e);
        return false;
      }
      this.db = await openDb(dbName, this.platform);
      this.isInit = true;

      const cleaned = docs
        .filter((d) => d && typeof (d as any)._id === "string")
        .map((d) => {
          const c = { ...d };
          delete (c as any)._rev;
          return c;
        });

      if (cleaned.length > 0) {
        try {
          const res: any = await this.db.bulkDocs(cleaned);
          // bulkDocs can partially fail; log any per-doc errors.
          const errors = Array.isArray(res)
            ? res.filter((r: any) => r && r.error)
            : [];
          if (errors.length > 0) {
            logger.warn("[import_legacy] bulkDocs reported errors", {
              count: errors.length,
              sample: errors.slice(0, 5).map((e: any) => ({
                id: e?.id,
                status: e?.status,
                name: e?.name,
                message: e?.message,
              })),
            });
          }
        } catch (e) {
          logger.warn("[import_legacy] bulkDocs failed", e);
          return false;
        }
      }

      this.settings = await safeGet<SettingsDoc>(this.db, "settings");
      if (!this.settings) {
        // Should not happen, but keep behavior consistent.
        logger.warn("[import_legacy] settings doc missing after import; reseeding");
        const settings: SettingsDoc = {
          _id: "settings",
          type: "settings",
          currency: DEFAULT_CURRENCY,
          language: DEFAULT_LANGUAGE,
          couchdbURL: normalizeCouchdbUrl(""),
          budget: { type: BudgetType.Daily, budget: 0 },
          lastUpdate: currentVersion,
        };
        await this.db.put(settings);
        this.settings = settings;
      }

      const catsRes = await this.db.allDocs({
        include_docs: true,
        startkey: "cat_",
        endkey: "cat_\uffff",
      });
      this.categories = catsRes.rows
        .map((r: any) => (r.doc as any)?.name)
        .filter((n: any): n is string => typeof n === "string");

      this.weekly_exp = undefined;
      this.monthly_exp = undefined;

      await this._restartSync();
      return true;
    },

    async _teardownLocalState() {
      this._stopSync("teardown");
      if (this._onlineListener) {
        window.removeEventListener("online", this._onlineListener);
      }
      this._onlineListener = undefined;
      try {
        if (
          this._appStateListener &&
          typeof this._appStateListener.remove === "function"
        ) {
          await this._appStateListener.remove();
        }
      } catch {
        // ignore
      }
      this._appStateListener = undefined;
      this._hooksSetup = false;

      if (this.db) {
        try {
          await this.db.destroy();
        } catch {
          // ignore
        }
      }

      this.db = undefined;
      this.settings = undefined;
      this.isInit = false;
      this.initPromise = undefined;
      this.categories = [];
      this.weekly_exp = undefined;
      this.monthly_exp = undefined;
    },

    async clear_data(): Promise<void> {
      // Stop sync first to avoid racing with remote deletion.
      this._stopSync("clear_data");

      const remoteUrl = (() => {
        try {
          const raw = this.settings ? this.settings.couchdbURL : "";
          return normalizeCouchdbUrl(raw);
        } catch {
          return "";
        }
      })();

      // Best-effort remote deletion (requires CouchDB admin perms).
      if (remoteUrl && remoteUrl.length > 0) {
        try {
          const remote = new PouchDB(remoteUrl);
          await remote.destroy();
          logger.info("[clear_data] remote destroyed", { url: remoteUrl });
        } catch (e) {
          logger.warn("[clear_data] remote destroy failed", e);
        }
      }

      // Destroy local DB and reset in-memory state.
      await this._teardownLocalState();

      // Re-seed defaults.
      await this.init({ dbName: this.dbName, platform: this.platform });
    },

    // Test helpers
    async __test_destroy_db() {
      await this._teardownLocalState();
    },
  };
}

export const model: any = createModel();
