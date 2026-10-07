import { error } from "console";
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

// A team lets colleagues see each other's tests/results without sharing a
// login. Membership is one-team-per-user (users.team_id), which is enough
// for "my team sees my runs" without building out a full multi-team model.
export const teams = createTable("team", {
  id: varchar("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  created_at: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const users = createTable("user", {
  id: varchar("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  email: varchar("email", { length: 256 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  passwordHash: text("password_hash"),
  image: text("image"),
  // Site-wide role. 'admin' sees every team's tests for overview/auditing;
  // everyone else only sees their own + their team's.
  role: varchar("role", { length: 32 }).default("tester").notNull(),
  teamId: varchar("team_id").references(() => teams.id),
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
  // 'url' = legacy CSV URL ramp test, 'scenario' = uploaded .jmx
  type: varchar("type", { length: 32 }).default("url").notNull(),
  urls: jsonb("urls"), // Array of URL strings. Nullable: scenarios don't use it.
  concurrency_pattern: jsonb("concurrency_pattern"), // Nullable for scenarios.
  duration: integer("duration"), // in seconds. Nullable: not all flows use it.
  ramp_up_time: integer("ramp_up_time"), // in seconds. Nullable for functional scenarios.
  ramp_down_time: integer("ramp_down_time"), // in seconds. Nullable for scenarios.
  // Scenario-only columns.
  mode: varchar("mode", { length: 32 }), // 'functional' | 'load'
  users: integer("users"), // virtual-user count for load scenarios
  jmx_filename: varchar("jmx_filename", { length: 512 }),
  file_id: varchar("file_id", { length: 64 }), // matches backend's UUID file_id
  scenario_metrics: jsonb("scenario_metrics"), // full final-metrics blob from backend on scenario_completed
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, running, completed, failed
  // Snapshot of the creator's team at the time the test was started, so a
  // test stays visible to that team even if the creator later changes teams.
  team_id: varchar("team_id").references(() => teams.id),
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

// Audit trail of deployment sign-off decisions against a test result. A
// test can collect more than one entry over time (e.g. a rejection followed
// later by an approval after fixes), so this is append-only — never updated
// or deleted — which is what makes it useful as an audit record.
export const signOffs = createTable("sign_off", {
  id: varchar("id").primaryKey(),
  test_id: varchar("test_id")
    .references(() => completeTests.id)
    .notNull(),
  user_id: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  decision: varchar("decision", { length: 32 }).notNull(), // 'approved' | 'approved_with_reservations' | 'rejected'
  comment: text("comment"),
  created_at: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// A reusable target (base URL + optional auth headers) so a tester doesn't
// have to retype the same URL/headers for every new test against the same
// system. Scoped to a team when the creator has one, otherwise personal.
export const environments = createTable("environment", {
  id: varchar("id").primaryKey(),
  user_id: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  team_id: varchar("team_id").references(() => teams.id),
  name: varchar("name", { length: 256 }).notNull(),
  base_url: varchar("base_url", { length: 2048 }).notNull(),
  headers: jsonb("headers"), // e.g. { "Authorization": "Bearer ..." } — see note in access.ts
  created_at: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});



