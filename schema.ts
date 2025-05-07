import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // 'user' or 'owner'
  status: text("status").notNull().default("active"), // 'active' or 'inactive'
  notificationOptIn: boolean("notification_opt_in").default(true),
  profilePictureUrl: text("profile_picture_url"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Contacts table
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("unread"), // 'unread', 'read', 'responded'
  responseMessage: text("response_message"),
  responseDate: timestamp("response_date"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Donations table
export const donations = pgTable("donations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(), // 'credit_card', 'debit_card', 'paypal', 'esewa', 'bank_qr'
  transactionId: text("transaction_id"), // For tracking external payment system IDs
  qrImageUrl: text("qr_image_url"), // For storing QR code image URL for bank transfers
  esewaReference: text("esewa_reference"), // For tracking eSewa payments
  status: text("status").notNull().default("pending"), // 'pending', 'completed', 'failed'
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Media table for Cloudinary assets
export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  cloudinaryUrl: text("cloudinary_url").notNull(),
  cloudinaryPublicId: text("cloudinary_public_id").notNull(),
  type: text("type").notNull(), // 'image' or 'video'
  title: text("title").notNull(),
  description: text("description"),
  uploadedBy: integer("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Events table
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  mediaId: integer("media_id").references(() => media.id),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Sermons table
export const sermons = pgTable("sermons", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  mediaId: integer("media_id").references(() => media.id).notNull(),
  duration: text("duration").notNull(), // Duration in format "MM:SS"
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Activities table for logging
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // Can be null for system actions
  action: text("action").notNull(), // 'login', 'signup', 'media_upload', 'donation', etc.
  details: text("details").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  donations: many(donations),
  activities: many(activities),
  media: many(media)
}));

export const donationsRelations = relations(donations, ({ one }) => ({
  user: one(users, { fields: [donations.userId], references: [users.id] })
}));

export const mediaRelations = relations(media, ({ one, many }) => ({
  uploader: one(users, { fields: [media.uploadedBy], references: [users.id] }),
  events: many(events),
  sermons: many(sermons)
}));

export const eventsRelations = relations(events, ({ one }) => ({
  media: one(media, { fields: [events.mediaId], references: [media.id] })
}));

export const sermonsRelations = relations(sermons, ({ one }) => ({
  media: one(media, { fields: [sermons.mediaId], references: [media.id] })
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, { fields: [activities.userId], references: [users.id] })
}));

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  email: (schema) => schema.email("Must provide a valid email"),
  password: (schema) => schema.min(6, "Password must be at least 6 characters"),
  role: (schema) => z.enum(["user", "owner"]),
  status: (schema) => z.enum(["active", "inactive"])
});

export const insertContactSchema = createInsertSchema(contacts, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  email: (schema) => schema.email("Must provide a valid email"),
  message: (schema) => schema.min(10, "Message must be at least 10 characters")
});

export const insertDonationSchema = createInsertSchema(donations, {
  amount: (schema) => schema.refine(val => parseFloat(val) > 0, "Amount must be greater than 0"),
  paymentMethod: (schema) => z.enum(["credit_card", "debit_card", "paypal", "esewa", "bank_qr"]),
  transactionId: (schema) => schema.optional(),
  qrImageUrl: (schema) => schema.optional(),
  esewaReference: (schema) => schema.optional(),
  status: (schema) => z.enum(["pending", "completed", "failed"])
});

export const insertMediaSchema = createInsertSchema(media, {
  title: (schema) => schema.min(2, "Title must be at least 2 characters"),
  type: (schema) => z.enum(["image", "video"])
});

export const insertEventSchema = createInsertSchema(events, {
  title: (schema) => schema.min(2, "Title must be at least 2 characters"),
  description: (schema) => schema.min(10, "Description must be at least 10 characters"),
  date: (schema) => schema.refine((date) => new Date(date) > new Date(), "Event date must be in the future")
});

export const insertSermonSchema = createInsertSchema(sermons, {
  title: (schema) => schema.min(2, "Title must be at least 2 characters"),
  description: (schema) => schema.min(10, "Description must be at least 10 characters")
});

export const insertActivitySchema = createInsertSchema(activities, {
  action: (schema) => z.enum([
    "login", "signup", "logout", "media_upload", "donation", 
    "contact_message", "user_update", "user_delete", "event_create", 
    "event_update", "event_delete", "sermon_create", "sermon_update", 
    "sermon_delete"
  ]),
  details: (schema) => schema.min(2, "Details must be at least 2 characters")
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type Donation = typeof donations.$inferSelect;
export type InsertDonation = z.infer<typeof insertDonationSchema>;

export type Media = typeof media.$inferSelect;
export type InsertMedia = z.infer<typeof insertMediaSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type Sermon = typeof sermons.$inferSelect;
export type InsertSermon = z.infer<typeof insertSermonSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
