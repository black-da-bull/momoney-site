// Prod schema for the console's project memory (Vercel Postgres, infra-spec §2).
// Mirrors apps/console/src/lib/store.ts's file-store shapes 1:1 so the swap is mechanical.
// Not yet wired — dev uses the file store; activation lands with the factory phase.

import { pgTable, text, timestamp, integer, jsonb, primaryKey } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // The artist's first input, verbatim, never edited (soul §2: raw input is immutable).
  seedRaw: text("seed_raw"),
});

export const ustSlots = pgTable(
  "ust_slots",
  {
    projectId: text("project_id").notNull().references(() => projects.id),
    address: text("address").notNull(), // AXIS.key
    axis: text("axis").notNull(),
    key: text("key").notNull(),
    value: text("value"), // null = reserved address, not missing
    status: text("status").notNull().default("NULL"), // NULL|PROPOSED|PRESSURED|RESOLVED|LOCKED
    provenance: text("provenance").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.address] })],
);

export const messages = pgTable("messages", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  role: text("role").notNull(), // artist | maestro
  text: text("text").notNull(), // artist text verbatim
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

// Append-only. Rows are never updated or deleted; supersession is a new row.
export const changeLog = pgTable("change_log", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  seq: integer("seq").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  address: text("address").notNull(),
  from: text("from"),
  to: text("to"),
  status: text("status").notNull(),
  provenance: text("provenance").notNull(),
  note: text("note").notNull().default(""),
  detail: jsonb("detail"),
});
