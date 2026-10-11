import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const demoVocabulary = pgTable("demo_vocabulary", {
  id: serial("id").primaryKey(),
  word: text("word").notNull().unique(),
  translation: text("translation").notNull(),
});
