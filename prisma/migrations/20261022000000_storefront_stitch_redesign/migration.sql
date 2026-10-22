-- AlterTable companies
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "meta_title" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "meta_description" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "sort" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable categories
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "meta_title" TEXT;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "meta_description" TEXT;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "sort" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "parent_id" TEXT;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "highlights" JSONB;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "specs" JSONB;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "meta_title" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "meta_description" TEXT;

-- CreateTable product_images
CREATE TABLE IF NOT EXISTS "product_images" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable product_reviews
CREATE TABLE IF NOT EXISTS "product_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "user_phone" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "title" TEXT,
    "comment" TEXT NOT NULL,
    "moderated" BOOLEAN NOT NULL DEFAULT false,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable slug_redirects
CREATE TABLE IF NOT EXISTS "slug_redirects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity" TEXT NOT NULL,
    "old_slug" TEXT NOT NULL,
    "new_slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable store_pages
CREATE TABLE IF NOT EXISTS "store_pages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable home_sections
CREATE TABLE IF NOT EXISTS "home_sections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable menu_items
CREATE TABLE IF NOT EXISTS "menu_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menu" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "menu_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable faqs
CREATE TABLE IF NOT EXISTS "faqs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "group" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable contact_messages
CREATE TABLE IF NOT EXISTS "contact_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'contact',
    "status" TEXT NOT NULL DEFAULT 'unread',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable user_addresses
CREATE TABLE IF NOT EXISTS "user_addresses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address_line" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'HOME',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable wishlist_items
CREATE TABLE IF NOT EXISTS "wishlist_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wishlist_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "wishlist_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique & Index Constraints
CREATE UNIQUE INDEX IF NOT EXISTS "companies_slug_key" ON "companies"("slug");
CREATE INDEX IF NOT EXISTS "companies_slug_idx" ON "companies"("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_key" ON "categories"("slug");
CREATE INDEX IF NOT EXISTS "categories_slug_idx" ON "categories"("slug");
CREATE INDEX IF NOT EXISTS "categories_parent_id_idx" ON "categories"("parent_id");
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'categories_parent_id_fkey'
    ) THEN
        ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "products_slug_key" ON "products"("slug");
CREATE INDEX IF NOT EXISTS "products_slug_idx" ON "products"("slug");

CREATE INDEX IF NOT EXISTS "product_images_product_id_sort_idx" ON "product_images"("product_id", "sort");
CREATE INDEX IF NOT EXISTS "product_reviews_product_id_approved_idx" ON "product_reviews"("product_id", "approved");

CREATE UNIQUE INDEX IF NOT EXISTS "slug_redirects_entity_old_slug_key" ON "slug_redirects"("entity", "old_slug");
CREATE INDEX IF NOT EXISTS "slug_redirects_entity_old_slug_idx" ON "slug_redirects"("entity", "old_slug");

CREATE UNIQUE INDEX IF NOT EXISTS "store_pages_slug_key" ON "store_pages"("slug");
CREATE INDEX IF NOT EXISTS "store_pages_slug_status_idx" ON "store_pages"("slug", "status");

CREATE INDEX IF NOT EXISTS "home_sections_active_sort_idx" ON "home_sections"("active", "sort");
CREATE INDEX IF NOT EXISTS "menu_items_menu_sort_idx" ON "menu_items"("menu", "sort");
CREATE INDEX IF NOT EXISTS "faqs_group_sort_idx" ON "faqs"("group", "sort");
CREATE INDEX IF NOT EXISTS "contact_messages_status_created_at_idx" ON "contact_messages"("status", "created_at");

CREATE INDEX IF NOT EXISTS "user_addresses_user_id_idx" ON "user_addresses"("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "wishlist_items_user_id_product_id_key" ON "wishlist_items"("user_id", "product_id");
CREATE INDEX IF NOT EXISTS "wishlist_items_user_id_idx" ON "wishlist_items"("user_id");
CREATE INDEX IF NOT EXISTS "wishlist_items_product_id_idx" ON "wishlist_items"("product_id");
