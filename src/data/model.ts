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

function ym(month: number, year: number): number {
  return year * 100 + (month + 1);
}

function monthId(month: number, year: number): string {
  return `month_${ym(month, year)}`;
}

function categoryId(name: string): string {
  return `cat_${encodeURIComponent(name)}`;
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
          await this.db.put(settings);
          this.settings = settings;

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

    async remove_expense(expense: SingleExpense) {
      await this.ensureInit();
      this.weekly_exp = undefined;
      this.monthly_exp = undefined;

      const anyExp: any = expense as any;
      const id =
        anyExp && typeof anyExp._id === "string" ? anyExp._id : undefined;
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
      const docs = await this.getExpenseDocsInRange(start, end);

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
      const docs = await this.getExpenseDocsInRange(start, end);
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

      const docs = await this.getExpenseDocsInRange(startTs, endTs);
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
      const docs = await this.getExpenseDocsInRange(rangeStart, rangeEnd);

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
      const selectedFile = await FilePicker.pickFiles({});
      const path = selectedFile.files[0].path;
      if (!path) return false;

      let obj: any;
      try {
        const blob = await fetch(path).then((r) => r.blob());
        const text = await blob.text();
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

    // Test helpers
    async __test_destroy_db() {
      this._stopSync();
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
      if (this.db) await this.db.destroy();
      this.db = undefined;
      this.settings = undefined;
      this.isInit = false;
      this.initPromise = undefined;
      this.categories = [];
      this.weekly_exp = undefined;
      this.monthly_exp = undefined;
    },
  };
}

export const model: any = createModel();
