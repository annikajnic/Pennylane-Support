-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "completionRate" REAL NOT NULL,
    "attemptCount" INTEGER NOT NULL,
    "averageAttemptsToPass" REAL NOT NULL,
    "author" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "learningObjectives" TEXT NOT NULL DEFAULT '[]',
    "hints" TEXT NOT NULL DEFAULT '[]',
    "prerequisiteIds" TEXT NOT NULL DEFAULT '[]'
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "challengeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "assignedTo" TEXT,
    "resolutionTimeHours" REAL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "Conversation_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Post" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "postNumber" INTEGER NOT NULL,
    "conversationId" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "helpful" INTEGER NOT NULL DEFAULT 0,
    "isAcceptedAnswer" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Post_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Challenge_category_idx" ON "Challenge"("category");

-- CreateIndex
CREATE INDEX "Challenge_difficulty_idx" ON "Challenge"("difficulty");

-- CreateIndex
CREATE INDEX "Conversation_status_idx" ON "Conversation"("status");

-- CreateIndex
CREATE INDEX "Conversation_assignedTo_idx" ON "Conversation"("assignedTo");

-- CreateIndex
CREATE INDEX "Conversation_challengeId_idx" ON "Conversation"("challengeId");

-- CreateIndex
CREATE INDEX "Post_user_idx" ON "Post"("user");

-- CreateIndex
CREATE UNIQUE INDEX "Post_conversationId_postNumber_key" ON "Post"("conversationId", "postNumber");
