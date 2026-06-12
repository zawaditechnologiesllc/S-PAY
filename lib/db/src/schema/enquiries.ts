import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

// Every enquiry from the landing page, contact page, and signed-in users —
// collected in one place, worked from Admin → Enquiries.
export const enquiriesTable = pgTable("enquiries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id"),                 // set when the sender was signed in
  name: text("name"),
  email: text("email").notNull(),
  subject: text("subject"),
  message: text("message").notNull(),
  source: text("source"),                  // landing | contact | app | jobs…
  status: text("status").default("new").notNull(), // new | resolved
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_enquiries_created").on(t.createdAt.desc()),
]).enableRLS();

export type Enquiry = typeof enquiriesTable.$inferSelect;
