/*
  Warnings:

  - Added the required column `userId` to the `Notebook` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Notebook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Notebook" ("createdAt", "id", "name", "updatedAt") SELECT "createdAt", "id", "name", "updatedAt" FROM "Notebook";
DROP TABLE "Notebook";
ALTER TABLE "new_Notebook" RENAME TO "Notebook";
CREATE INDEX "Notebook_userId_idx" ON "Notebook"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
