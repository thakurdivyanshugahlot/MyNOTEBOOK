-- CreateTable
CREATE TABLE "Notebook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notebookId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "filePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'uploading',
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Source_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
