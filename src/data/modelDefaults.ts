import { env } from "@/env";

export const MODEL_SCHEMA_VERSION = 1;

export enum BudgetType {
  Monthly = 0,
  Daily = 1,
}

export const DEFAULT_CURRENCY = "€";
export const DEFAULT_LANGUAGE = "en";

export const DEFAULT_COUCHDB_URL =
  typeof env.VITE_DEFAULT_COUCHDB_URL === "string"
    ? env.VITE_DEFAULT_COUCHDB_URL
    : "";

// Budget type matches existing UI/model semantics.
export const DEFAULT_BUDGET = {
  type: BudgetType.Monthly,
  budget: 0,
};

export const DEFAULT_CATEGORIES = [
  "Rent 🏠",
  "Grocery 🍴",
  "Eating out 🌮",
  "Drinks 🍸",
  "Hobbies 🥏",
  "Travel 🚞",
  "Clothes 👖",
  "Car expenses 🚗",
  "Bills 📄",
  "Subscriptions 🖥",
  "Other expenses 📁",
];
