-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TripCategory" AS ENUM ('ADVENTURE', 'LUXURY', 'CULTURAL', 'WELLNESS', 'WILDLIFE');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('ADULTS', 'CHILDREN', 'BOTH');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('ACTIVITY', 'ACCOMMODATION', 'TRANSPORT', 'MEAL', 'POI');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('COP', 'USD', 'EUR');

-- CreateEnum
CREATE TYPE "ExpeditionStatus" AS ENUM ('AVAILABLE', 'FULL', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BookingItemType" AS ENUM ('ADULT', 'CHILD', 'EXTRA');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "AgencyApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "user" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "email" STRING NOT NULL,
    "email_verified" BOOL NOT NULL DEFAULT false,
    "image" STRING,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "dni_user" STRING,
    "phone_user" STRING,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" STRING NOT NULL,
    "user_id" STRING NOT NULL,
    "token" STRING NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" STRING,
    "user_agent" STRING,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" STRING NOT NULL,
    "user_id" STRING NOT NULL,
    "account_id" STRING NOT NULL,
    "provider_id" STRING NOT NULL,
    "access_token" STRING,
    "refresh_token" STRING,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" STRING,
    "id_token" STRING,
    "password" STRING,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" STRING NOT NULL,
    "identifier" STRING NOT NULL,
    "value" STRING NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id_city" INT8 NOT NULL DEFAULT unique_rowid(),
    "name_city" STRING NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id_city")
);

-- CreateTable
CREATE TABLE "agencies" (
    "id_agency" INT8 NOT NULL DEFAULT unique_rowid(),
    "name_agency" STRING NOT NULL,
    "email" STRING,
    "phone" STRING,
    "nit" STRING,
    "rnt_number" STRING,
    "picture" STRING,
    "status" STRING NOT NULL DEFAULT 'active',
    "approval_status" "AgencyApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" STRING,
    "reviewed_by" STRING,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id_agency")
);

-- CreateTable
CREATE TABLE "agency_members" (
    "id" INT8 NOT NULL DEFAULT unique_rowid(),
    "id_agency" INT8 NOT NULL,
    "user_id" STRING NOT NULL,
    "role" STRING NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id_trip" INT8 NOT NULL DEFAULT unique_rowid(),
    "id_agency" INT8 NOT NULL,
    "id_city" INT8 NOT NULL,
    "title" STRING NOT NULL,
    "description" STRING,
    "category" "TripCategory" NOT NULL,
    "destination_region" STRING,
    "latitude" DECIMAL(65,30),
    "longitude" DECIMAL(65,30),
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "duration_days" INT4 NOT NULL,
    "duration_nights" INT4 NOT NULL,
    "price" DECIMAL(65,30),
    "currency" "Currency",
    "price_type" "PriceType",
    "max_persons" INT4,
    "cover_image" STRING,
    "cover_image_index" INT4,
    "status" "TripStatus" NOT NULL DEFAULT 'DRAFT',
    "is_active" BOOL NOT NULL DEFAULT true,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id_trip")
);

-- CreateTable
CREATE TABLE "route_points" (
    "id" INT8 NOT NULL DEFAULT unique_rowid(),
    "id_trip" INT8 NOT NULL,
    "name" STRING NOT NULL,
    "latitude" DECIMAL(65,30) NOT NULL,
    "longitude" DECIMAL(65,30) NOT NULL,
    "order" INT4 NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_gallery_images" (
    "id" INT8 NOT NULL DEFAULT unique_rowid(),
    "id_trip" INT8 NOT NULL,
    "image_url" STRING NOT NULL,
    "order" INT4 NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_gallery_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itinerary_days" (
    "id" INT8 NOT NULL DEFAULT unique_rowid(),
    "id_trip" INT8 NOT NULL,
    "day" INT4 NOT NULL,
    "title" STRING NOT NULL,
    "subtitle" STRING,
    "order" INT4 NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itinerary_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itinerary_activities" (
    "id" INT8 NOT NULL DEFAULT unique_rowid(),
    "id_day" INT8 NOT NULL,
    "type" "ActivityType" NOT NULL,
    "title" STRING NOT NULL,
    "description" STRING,
    "time" STRING,
    "image_url" STRING,
    "latitude" DECIMAL(65,30),
    "longitude" DECIMAL(65,30),
    "poi_id" STRING,
    "order" INT4 NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itinerary_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expeditions" (
    "id_expedition" INT8 NOT NULL DEFAULT unique_rowid(),
    "id_trip" INT8 NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "capacity_total" INT4 NOT NULL,
    "capacity_available" INT4 NOT NULL,
    "price_adult" DECIMAL(65,30) NOT NULL,
    "price_child" DECIMAL(65,30),
    "currency" STRING NOT NULL DEFAULT 'USD',
    "status" "ExpeditionStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expeditions_pkey" PRIMARY KEY ("id_expedition")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id_booking" INT8 NOT NULL DEFAULT unique_rowid(),
    "id_expedition" INT8 NOT NULL,
    "id_trip" INT8 NOT NULL,
    "id_agency" INT8 NOT NULL,
    "owner_buy" STRING NOT NULL,
    "date_buy" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference_buy" STRING,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(65,30) NOT NULL,
    "service_fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount_code" STRING,
    "discount_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_buy" DECIMAL(65,30) NOT NULL,
    "currency" STRING NOT NULL DEFAULT 'USD',
    "transaction_id" STRING,
    "payment_source" STRING,
    "tickets_pdf_key" STRING,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id_booking")
);

-- CreateTable
CREATE TABLE "booking_items" (
    "id" INT8 NOT NULL DEFAULT unique_rowid(),
    "id_booking" INT8 NOT NULL,
    "item_type" "BookingItemType" NOT NULL,
    "description" STRING,
    "quantity" INT4 NOT NULL,
    "unit_price" DECIMAL(65,30) NOT NULL,
    "total_price" DECIMAL(65,30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_codes" (
    "id" INT8 NOT NULL DEFAULT unique_rowid(),
    "code_name" STRING NOT NULL,
    "discount_type" "DiscountType" NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "max_uses" INT4,
    "per_user_limit" INT4,
    "used_count" INT4 NOT NULL DEFAULT 0,
    "active" BOOL NOT NULL DEFAULT true,
    "id_agency" INT8,
    "id_trip" INT8,
    "id_expedition" INT8,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_code_usage" (
    "id" INT8 NOT NULL DEFAULT unique_rowid(),
    "discount_code_id" INT8 NOT NULL,
    "user_id" STRING NOT NULL,
    "booking_id" INT8 NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_code_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_nit_key" ON "agencies"("nit");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_rnt_number_key" ON "agencies"("rnt_number");

-- CreateIndex
CREATE UNIQUE INDEX "agency_members_id_agency_user_id_key" ON "agency_members"("id_agency", "user_id");

-- CreateIndex
CREATE INDEX "route_points_id_trip_idx" ON "route_points"("id_trip");

-- CreateIndex
CREATE INDEX "trip_gallery_images_id_trip_idx" ON "trip_gallery_images"("id_trip");

-- CreateIndex
CREATE INDEX "itinerary_days_id_trip_idx" ON "itinerary_days"("id_trip");

-- CreateIndex
CREATE INDEX "itinerary_activities_id_day_idx" ON "itinerary_activities"("id_day");

-- CreateIndex
CREATE UNIQUE INDEX "discount_codes_code_name_key" ON "discount_codes"("code_name");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_members" ADD CONSTRAINT "agency_members_id_agency_fkey" FOREIGN KEY ("id_agency") REFERENCES "agencies"("id_agency") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_members" ADD CONSTRAINT "agency_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_id_agency_fkey" FOREIGN KEY ("id_agency") REFERENCES "agencies"("id_agency") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_id_city_fkey" FOREIGN KEY ("id_city") REFERENCES "cities"("id_city") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_points" ADD CONSTRAINT "route_points_id_trip_fkey" FOREIGN KEY ("id_trip") REFERENCES "trips"("id_trip") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_gallery_images" ADD CONSTRAINT "trip_gallery_images_id_trip_fkey" FOREIGN KEY ("id_trip") REFERENCES "trips"("id_trip") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_days" ADD CONSTRAINT "itinerary_days_id_trip_fkey" FOREIGN KEY ("id_trip") REFERENCES "trips"("id_trip") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_activities" ADD CONSTRAINT "itinerary_activities_id_day_fkey" FOREIGN KEY ("id_day") REFERENCES "itinerary_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expeditions" ADD CONSTRAINT "expeditions_id_trip_fkey" FOREIGN KEY ("id_trip") REFERENCES "trips"("id_trip") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_id_expedition_fkey" FOREIGN KEY ("id_expedition") REFERENCES "expeditions"("id_expedition") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_id_trip_fkey" FOREIGN KEY ("id_trip") REFERENCES "trips"("id_trip") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_id_agency_fkey" FOREIGN KEY ("id_agency") REFERENCES "agencies"("id_agency") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_owner_buy_fkey" FOREIGN KEY ("owner_buy") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_id_booking_fkey" FOREIGN KEY ("id_booking") REFERENCES "bookings"("id_booking") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_id_agency_fkey" FOREIGN KEY ("id_agency") REFERENCES "agencies"("id_agency") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_id_trip_fkey" FOREIGN KEY ("id_trip") REFERENCES "trips"("id_trip") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_id_expedition_fkey" FOREIGN KEY ("id_expedition") REFERENCES "expeditions"("id_expedition") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_code_usage" ADD CONSTRAINT "discount_code_usage_discount_code_id_fkey" FOREIGN KEY ("discount_code_id") REFERENCES "discount_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_code_usage" ADD CONSTRAINT "discount_code_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_code_usage" ADD CONSTRAINT "discount_code_usage_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id_booking") ON DELETE CASCADE ON UPDATE CASCADE;
