-- CreateTable
CREATE TABLE "promoters" (
    "id_promoter" INT8 NOT NULL DEFAULT unique_rowid(),
    "id_agency" INT8 NOT NULL,
    "code" STRING NOT NULL,
    "name" STRING NOT NULL,
    "email" STRING,
    "phone" STRING,
    "referral_count" INT4 NOT NULL DEFAULT 0,
    "is_active" BOOL NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promoters_pkey" PRIMARY KEY ("id_promoter")
);

-- CreateIndex
CREATE UNIQUE INDEX "promoters_code_key" ON "promoters"("code");

-- AddForeignKey
ALTER TABLE "promoters" ADD CONSTRAINT "promoters_id_agency_fkey" FOREIGN KEY ("id_agency") REFERENCES "agencies"("id_agency") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "trips" ADD COLUMN "id_promoter" INT8;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_id_promoter_fkey" FOREIGN KEY ("id_promoter") REFERENCES "promoters"("id_promoter") ON DELETE SET NULL ON UPDATE CASCADE;
