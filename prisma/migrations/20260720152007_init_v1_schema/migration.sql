-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('NEVER_PUBLISHED', 'PUBLISHED', 'UNPUBLISHED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SponsorTier" AS ENUM ('PARTNER', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "PublishRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('HERO', 'VENUE', 'SPEAKER_PHOTO', 'TEAM_PHOTO', 'SPONSOR_LOGO');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('IMPERSONATION', 'INAPPROPRIATE_CONTENT', 'SPAM_OR_SCAM', 'COPYRIGHT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'NEVER_PUBLISHED',
    "liveSnapshotId" TEXT,
    "tedEventUrl" TEXT NOT NULL,
    "licenseHolderName" TEXT NOT NULL,
    "authorizationConfirmedAt" TIMESTAMP(3) NOT NULL,
    "theme" TEXT,
    "aboutText" TEXT,
    "eventDate" TIMESTAMP(3),
    "timezone" TEXT,
    "venueName" TEXT,
    "venueAddress" TEXT,
    "venueDescription" TEXT,
    "contactEmail" TEXT,
    "registrationUrl" TEXT,
    "socialLinks" JSONB,
    "heroImageId" TEXT,
    "venueImageId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaker" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "bio" TEXT,
    "talkTitle" TEXT,
    "photoId" TEXT,
    "links" JSONB,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speaker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "photoId" TEXT,
    "links" JSONB,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsor" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoId" TEXT,
    "websiteUrl" TEXT,
    "tier" "SponsorTier" NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_asset" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "uploaderId" TEXT,
    "cloudinaryPublicId" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "format" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snapshot" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_request" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "status" "PublishRequestStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    "rejectionReason" TEXT,
    "pendingEventId" TEXT,

    CONSTRAINT "publish_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preview_token" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "preview_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "category" "ReportCategory" NOT NULL,
    "explanation" TEXT NOT NULL,
    "reporterEmail" TEXT,
    "reporterIpHash" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolverId" TEXT,

    CONSTRAINT "report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "event_slug_key" ON "event"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "event_liveSnapshotId_key" ON "event"("liveSnapshotId");

-- CreateIndex
CREATE INDEX "event_ownerId_idx" ON "event"("ownerId");

-- CreateIndex
CREATE INDEX "event_publicationStatus_idx" ON "event"("publicationStatus");

-- CreateIndex
CREATE INDEX "speaker_eventId_sortOrder_idx" ON "speaker"("eventId", "sortOrder");

-- CreateIndex
CREATE INDEX "team_member_eventId_sortOrder_idx" ON "team_member"("eventId", "sortOrder");

-- CreateIndex
CREATE INDEX "sponsor_eventId_tier_sortOrder_idx" ON "sponsor"("eventId", "tier", "sortOrder");

-- CreateIndex
CREATE INDEX "faq_eventId_sortOrder_idx" ON "faq"("eventId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "media_asset_cloudinaryPublicId_key" ON "media_asset"("cloudinaryPublicId");

-- CreateIndex
CREATE INDEX "media_asset_eventId_idx" ON "media_asset"("eventId");

-- CreateIndex
CREATE INDEX "snapshot_eventId_createdAt_idx" ON "snapshot"("eventId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "publish_request_pendingEventId_key" ON "publish_request"("pendingEventId");

-- CreateIndex
CREATE INDEX "publish_request_eventId_submittedAt_idx" ON "publish_request"("eventId", "submittedAt");

-- CreateIndex
CREATE INDEX "publish_request_status_submittedAt_idx" ON "publish_request"("status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "preview_token_token_key" ON "preview_token"("token");

-- CreateIndex
CREATE INDEX "preview_token_eventId_idx" ON "preview_token"("eventId");

-- CreateIndex
CREATE INDEX "report_status_createdAt_idx" ON "report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "report_eventId_createdAt_idx" ON "report"("eventId", "createdAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_liveSnapshotId_fkey" FOREIGN KEY ("liveSnapshotId") REFERENCES "snapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_heroImageId_fkey" FOREIGN KEY ("heroImageId") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_venueImageId_fkey" FOREIGN KEY ("venueImageId") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaker" ADD CONSTRAINT "speaker_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaker" ADD CONSTRAINT "speaker_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsor" ADD CONSTRAINT "sponsor_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsor" ADD CONSTRAINT "sponsor_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq" ADD CONSTRAINT "faq_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshot" ADD CONSTRAINT "snapshot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_request" ADD CONSTRAINT "publish_request_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_request" ADD CONSTRAINT "publish_request_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_request" ADD CONSTRAINT "publish_request_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preview_token" ADD CONSTRAINT "preview_token_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_resolverId_fkey" FOREIGN KEY ("resolverId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

