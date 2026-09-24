ALTER TABLE `orders` ADD `idempotency_key` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `carrier` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking_number` text;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_idempotency_key_unique` ON `orders` (`idempotency_key`) WHERE "orders"."idempotency_key" is not null;