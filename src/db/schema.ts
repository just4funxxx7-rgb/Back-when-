import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default('Outcast Survivor'),
  role: text('role').notNull().default('survivor'),
  unifiedProjectName: text('unified_project_name').notNull().default('Aetheria: Outcast Lands'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const cloudSaves = pgTable('cloud_saves', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid)
    .notNull()
    .unique(),
  level: integer('level').notNull().default(1),
  moralKarma: integer('moral_karma').notNull().default(15),
  dayCount: integer('day_count').notNull().default(1),
  savePayloadJson: text('save_payload_json').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const expeditionLogs = pgTable('expedition_logs', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid)
    .notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  googleDocId: text('google_doc_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  saves: many(cloudSaves),
  logs: many(expeditionLogs),
}));

export const cloudSavesRelations = relations(cloudSaves, ({ one }) => ({
  user: one(users, {
    fields: [cloudSaves.userUid],
    references: [users.uid],
  }),
}));

export const expeditionLogsRelations = relations(expeditionLogs, ({ one }) => ({
  user: one(users, {
    fields: [expeditionLogs.userUid],
    references: [users.uid],
  }),
}));
