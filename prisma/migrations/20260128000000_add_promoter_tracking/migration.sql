-- AlterTable: Agregar viewCount a promoters
ALTER TABLE "promoters" ADD COLUMN "view_count" INT4 NOT NULL DEFAULT 0;

-- AlterTable: Agregar promoterCode a bookings
ALTER TABLE "bookings" ADD COLUMN "promoter_code" STRING;

-- CreateTable: PromoterView para registrar vistas únicas
CREATE TABLE "promoter_views" (
    "id" INT8 NOT NULL DEFAULT unique_rowid(),
    "promoter_id" INT8 NOT NULL,
    "id_trip" INT8 NOT NULL,
    "user_id" STRING,
    "ip_address" STRING,
    "user_agent" STRING,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promoter_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promoter_views_promoter_id_id_trip_user_id_key" ON "promoter_views"("promoter_id", "id_trip", "user_id");

-- CreateIndex
CREATE INDEX "promoter_views_promoter_id_idx" ON "promoter_views"("promoter_id");

-- CreateIndex
CREATE INDEX "promoter_views_id_trip_idx" ON "promoter_views"("id_trip");

-- AddForeignKey
ALTER TABLE "promoter_views" ADD CONSTRAINT "promoter_views_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "promoters"("id_promoter") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoter_views" ADD CONSTRAINT "promoter_views_id_trip_fkey" FOREIGN KEY ("id_trip") REFERENCES "trips"("id_trip") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoter_views" ADD CONSTRAINT "promoter_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
