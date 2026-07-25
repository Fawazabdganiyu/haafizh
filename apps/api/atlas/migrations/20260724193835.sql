-- Modify "contacts" table
ALTER TABLE "public"."contacts" ADD COLUMN "sourceContactId" text NULL, ADD CONSTRAINT "contacts_sourceContactId_fkey" FOREIGN KEY ("sourceContactId") REFERENCES "public"."contacts" ("id") ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
-- Validate "contacts_sourceContactId_fkey" constraint
ALTER TABLE "public"."contacts" VALIDATE CONSTRAINT "contacts_sourceContactId_fkey";
-- Create index "contacts_orgId_sourceContactId_key" to table: "contacts"
CREATE UNIQUE INDEX "contacts_orgId_sourceContactId_key" ON "public"."contacts" ("orgId", "sourceContactId");
-- Create index "contacts_sourceContactId_idx" to table: "contacts"
CREATE INDEX "contacts_sourceContactId_idx" ON "public"."contacts" ("sourceContactId");
-- Modify "transactions" table
ALTER TABLE "public"."transactions" ADD COLUMN "orgSourceTransactionId" text NULL, ADD CONSTRAINT "transactions_orgSourceTransactionId_fkey" FOREIGN KEY ("orgSourceTransactionId") REFERENCES "public"."transactions" ("id") ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
-- Validate "transactions_orgSourceTransactionId_fkey" constraint
ALTER TABLE "public"."transactions" VALIDATE CONSTRAINT "transactions_orgSourceTransactionId_fkey";
-- Create index "transactions_orgSourceTransactionId_key" to table: "transactions"
CREATE UNIQUE INDEX "transactions_orgSourceTransactionId_key" ON "public"."transactions" ("orgSourceTransactionId");
