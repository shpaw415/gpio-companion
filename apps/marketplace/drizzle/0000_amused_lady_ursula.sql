CREATE TABLE `inventory` (
	`product_id` text PRIMARY KEY NOT NULL,
	`on_hand` integer DEFAULT 0 NOT NULL,
	`reserved` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "inventory_on_hand_check" CHECK("inventory"."on_hand" >= 0),
	CONSTRAINT "inventory_reserved_check" CHECK("inventory"."reserved" >= 0),
	CONSTRAINT "inventory_reserved_on_hand_check" CHECK("inventory"."reserved" <= "inventory"."on_hand")
);
--> statement-breakpoint
CREATE TABLE `inventory_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`reference_id` text,
	`actor_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `inventory`(`product_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "inventory_adjustments_delta_check" CHECK("inventory_adjustments"."delta" <> 0)
);
--> statement-breakpoint
CREATE INDEX `inventory_adjustments_product_created_idx` ON `inventory_adjustments` (`product_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_adjustments_product_reference_unique` ON `inventory_adjustments` (`product_id`,`reference_id`) WHERE "inventory_adjustments"."reference_id" is not null;--> statement-breakpoint
CREATE TABLE `inventory_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `inventory`(`product_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "inventory_reservations_quantity_check" CHECK("inventory_reservations"."quantity" > 0),
	CONSTRAINT "inventory_reservations_status_check" CHECK("inventory_reservations"."status" in ('active', 'released', 'consumed', 'expired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_reservations_idempotency_unique` ON `inventory_reservations` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `inventory_reservations_product_status_idx` ON `inventory_reservations` (`product_id`,`status`);--> statement-breakpoint
CREATE INDEX `inventory_reservations_expiry_idx` ON `inventory_reservations` (`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `inventory_reservations_order_idx` ON `inventory_reservations` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text,
	`sku` text NOT NULL,
	`name_en` text NOT NULL,
	`name_fr` text NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`quantity` integer NOT NULL,
	`line_total_cents` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "order_items_unit_price_check" CHECK("order_items"."unit_price_cents" >= 0),
	CONSTRAINT "order_items_quantity_check" CHECK("order_items"."quantity" > 0),
	CONSTRAINT "order_items_line_total_check" CHECK("order_items"."line_total_cents" = "order_items"."unit_price_cents" * "order_items"."quantity")
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`fulfillment_status` text DEFAULT 'unfulfilled' NOT NULL,
	`paypal_order_id` text,
	`paypal_capture_id` text,
	`subtotal_cents` integer NOT NULL,
	`shipping_cents` integer NOT NULL,
	`tax_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`shipping_name` text NOT NULL,
	`shipping_line1` text NOT NULL,
	`shipping_line2` text,
	`shipping_city` text NOT NULL,
	`shipping_region` text,
	`shipping_postal_code` text NOT NULL,
	`shipping_country` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`paid_at` integer,
	`fulfilled_at` integer,
	`cancelled_at` integer,
	CONSTRAINT "orders_status_check" CHECK("orders"."status" in ('pending', 'confirmed', 'completed', 'cancelled')),
	CONSTRAINT "orders_payment_status_check" CHECK("orders"."payment_status" in ('pending', 'authorized', 'captured', 'failed', 'refunded', 'voided')),
	CONSTRAINT "orders_fulfillment_status_check" CHECK("orders"."fulfillment_status" in ('unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled')),
	CONSTRAINT "orders_currency_check" CHECK("orders"."currency" = 'USD'),
	CONSTRAINT "orders_amounts_check" CHECK("orders"."subtotal_cents" >= 0 and "orders"."shipping_cents" >= 0 and "orders"."tax_cents" >= 0 and "orders"."total_cents" = "orders"."subtotal_cents" + "orders"."shipping_cents" + "orders"."tax_cents")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_paypal_order_id_unique` ON `orders` (`paypal_order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_paypal_capture_id_unique` ON `orders` (`paypal_capture_id`);--> statement-breakpoint
CREATE INDEX `orders_user_created_idx` ON `orders` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_status_created_idx` ON `orders` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text DEFAULT 'paypal' NOT NULL,
	`provider_event_id` text NOT NULL,
	`order_id` text,
	`event_type` text NOT NULL,
	`payload` text NOT NULL,
	`processed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_events_provider_event_id_unique` ON `payment_events` (`provider_event_id`);--> statement-breakpoint
CREATE INDEX `payment_events_order_idx` ON `payment_events` (`order_id`);--> statement-breakpoint
CREATE TABLE `policies` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title_en` text NOT NULL,
	`title_fr` text NOT NULL,
	`body_en` text NOT NULL,
	`body_fr` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`published_at` integer,
	CONSTRAINT "policies_status_check" CHECK("policies"."status" in ('draft', 'published'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `policies_slug_unique` ON `policies` (`slug`);--> statement-breakpoint
CREATE INDEX `policies_status_idx` ON `policies` (`status`);--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`alt_en` text NOT NULL,
	`alt_fr` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "product_images_sort_check" CHECK("product_images"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_images_r2_key_unique` ON `product_images` (`r2_key`);--> statement-breakpoint
CREATE INDEX `product_images_product_sort_idx` ON `product_images` (`product_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`sku` text NOT NULL,
	`name_en` text NOT NULL,
	`name_fr` text NOT NULL,
	`description_en` text NOT NULL,
	`description_fr` text NOT NULL,
	`price_cents` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`published_at` integer,
	CONSTRAINT "products_status_check" CHECK("products"."status" in ('draft', 'published', 'archived')),
	CONSTRAINT "products_price_cents_check" CHECK("products"."price_cents" is null or "products"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE INDEX `products_status_idx` ON `products` (`status`);--> statement-breakpoint
CREATE TABLE `shipping_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`country` text NOT NULL,
	`region` text,
	`flat_cents` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "shipping_rates_flat_cents_check" CHECK("shipping_rates"."flat_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipping_rates_country_default_unique` ON `shipping_rates` (`country`) WHERE "shipping_rates"."region" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `shipping_rates_country_region_unique` ON `shipping_rates` (`country`,`region`) WHERE "shipping_rates"."region" is not null;--> statement-breakpoint
CREATE INDEX `shipping_rates_destination_idx` ON `shipping_rates` (`country`,`region`,`active`);