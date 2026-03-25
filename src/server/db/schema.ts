import { sql } from "drizzle-orm";
import {
  serial,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  unique,
  boolean,
  index,
  pgTableCreator
} from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `loadforge_${name}`);

export const users = createTable("user", {
  id: varchar("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  email: varchar("email", { length: 256 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  passwordHash: text("password_hash"),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = createTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table:any) => [index("session_userId_idx").on(table.userId)],
);

export const account = createTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table:any) => [index("account_userId_idx").on(table.userId)],
);

export const verification = createTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table:any) => [index("verification_identifier_idx").on(table.identifier)],
);

export const testPhases = createTable(
  "test_phase",
  {
    id: varchar("id").primaryKey(),
    test_id: varchar("test_id")
      .references(() => completeTests.id)
      .notNull(),
    user_id: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    phase_number: integer("phase_number").notNull(),
    total_phases: integer("total_phases").notNull(),
    concurrency: integer("concurrency").notNull(),
    requests: integer("requests").notNull(),
    success_count: integer("success_count").notNull(),
    error_count: integer("error_count").notNull(),
    percentile: jsonb("percentile").notNull(), // e.g., { p50: 120, p95: 300, p99: 450 }]
    created_at: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_at: timestamp("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table:any) => ({
    uniqueTestPhase: unique().on(table.test_id, table.phase_number),
  })
);

export const completeTests = createTable("load_test", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  urls: jsonb("urls").notNull(), // Array of URL strings
  concurrency_pattern: jsonb("concurrency_pattern").notNull(), // Array of concurrency values
  duration: integer("duration").notNull(), // in seconds
  ramp_up_time: integer("ramp_up_time").notNull(), // in seconds
  ramp_down_time: integer("ramp_down_time").notNull(), // in seconds
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, running, completed, failed
  created_at: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  completed_at: timestamp("completed_at"),
});

export const testResults = createTable("test_result", {
  id: varchar("id").primaryKey(),
  test_id: varchar("test_id").references(() => completeTests.id),
  user_id: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  total_requests: integer("total_requests").notNull(),
  successful_requests: integer("successful_requests").notNull(),
  failed_requests: integer("failed_requests").notNull(),
  avg_response_time: integer("avg_response_time").notNull(), // in ms
  min_response_time: integer("min_response_time").notNull(),
  max_response_time: integer("max_response_time").notNull(),
  p50_response_time: integer("p50_response_time").notNull(),
  p95_response_time: integer("p95_response_time").notNull(),
  p99_response_time: integer("p99_response_time").notNull(),
  requests_per_second: integer("requests_per_second").notNull(),
  url_breakdown: jsonb("url_breakdown").notNull(), // Per-URL metrics
  phase_metrics: jsonb("phase_metrics").notNull(), // Ramp-up, steady, ramp-down metrics
  created_at: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const settings = createTable("setting", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 256 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});



