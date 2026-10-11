CREATE TABLE "demo_vocabulary" (
	"id" serial PRIMARY KEY NOT NULL,
	"word" text NOT NULL,
	"translation" text NOT NULL,
	CONSTRAINT "demo_vocabulary_word_unique" UNIQUE("word")
);
