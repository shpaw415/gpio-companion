import { and, eq, gt, sql } from "drizzle-orm";
import type { CommerceDatabase } from "../db/client";
import {
	inventory,
	inventoryAdjustments,
	inventoryReservations,
} from "../db/schema";
import { classifyReplay } from "./idempotency";
import { generateCommerceId, unixNow } from "./identifiers";

export interface CreateReservationInput {
	idempotencyKey: string;
	orderId: string;
	productId: string;
	quantity: number;
	expiresAt: number;
}

function assertReservationInput(
	input: CreateReservationInput,
	now: number,
): void {
	if (!input.idempotencyKey.trim())
		throw new Error("Idempotency key is required");
	if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) {
		throw new Error("Reservation quantity must be a positive integer");
	}
	if (!Number.isSafeInteger(input.expiresAt) || input.expiresAt <= now) {
		throw new Error("Reservation expiry must be a future Unix timestamp");
	}
}

function replayShape(input: CreateReservationInput) {
	return {
		idempotencyKey: input.idempotencyKey,
		orderId: input.orderId,
		productId: input.productId,
		quantity: input.quantity,
		expiresAt: input.expiresAt,
	};
}

function reservedQuantity(productId: string, now: number) {
	return sql<number>`coalesce((select sum(${inventoryReservations.quantity}) from ${inventoryReservations} where ${inventoryReservations.productId} = ${productId} and ${inventoryReservations.status} = 'active' and ${inventoryReservations.expiresAt} > ${now}), 0)`;
}

export async function createInventoryReservation(
	db: CommerceDatabase,
	input: CreateReservationInput,
	now = unixNow(),
) {
	assertReservationInput(input, now);
	const normalized = { ...input, idempotencyKey: input.idempotencyKey.trim() };
	const [existing] = await db
		.select()
		.from(inventoryReservations)
		.where(eq(inventoryReservations.idempotencyKey, normalized.idempotencyKey))
		.limit(1);
	if (existing) {
		const decision = classifyReplay(
			replayShape(existing),
			replayShape(normalized),
		);
		if (decision === "conflict") {
			throw new Error(
				"Reservation idempotency key was reused with different content",
			);
		}
		return { reservation: existing, replayed: true } as const;
	}

	const id = generateCommerceId("rsv");
	const candidate = db
		.select({
			id: sql<string>`${id}`.as("id"),
			idempotencyKey: sql<string>`${normalized.idempotencyKey}`.as(
				"idempotency_key",
			),
			orderId: sql<string>`${normalized.orderId}`.as("order_id"),
			productId: inventory.productId,
			quantity: sql<number>`${normalized.quantity}`.as("quantity"),
			status: sql<"active">`'active'`.as("status"),
			expiresAt: sql<number>`${normalized.expiresAt}`.as("expires_at"),
			createdAt: sql<number>`${now}`.as("created_at"),
			updatedAt: sql<number>`${now}`.as("updated_at"),
		})
		.from(inventory)
		.where(
			and(
				eq(inventory.productId, normalized.productId),
				sql`${inventory.onHand} - ${reservedQuantity(normalized.productId, now)} >= ${normalized.quantity}`,
				sql`not exists (select 1 from ${inventoryReservations} where ${inventoryReservations.idempotencyKey} = ${normalized.idempotencyKey})`,
			),
		);

	await db.batch([
		db.insert(inventoryReservations).select(candidate),
		db
			.update(inventory)
			.set({
				reserved: reservedQuantity(normalized.productId, now),
				updatedAt: now,
			})
			.where(eq(inventory.productId, normalized.productId)),
	]);

	const [reservation] = await db
		.select()
		.from(inventoryReservations)
		.where(eq(inventoryReservations.idempotencyKey, normalized.idempotencyKey))
		.limit(1);
	if (!reservation) throw new Error("Insufficient inventory for reservation");
	const decision = classifyReplay(
		replayShape(reservation),
		replayShape(normalized),
	);
	if (decision === "conflict") {
		throw new Error(
			"Reservation idempotency key was reused with different content",
		);
	}
	return { reservation, replayed: reservation.id !== id } as const;
}

export async function releaseInventoryReservation(
	db: CommerceDatabase,
	id: string,
	now = unixNow(),
) {
	const [reservation] = await db
		.select()
		.from(inventoryReservations)
		.where(eq(inventoryReservations.id, id))
		.limit(1);
	if (!reservation) return null;
	if (reservation.status === "consumed") {
		throw new Error("Consumed reservations cannot be released");
	}
	if (reservation.status !== "active") return reservation;
	const status = reservation.expiresAt <= now ? "expired" : "released";
	await db.batch([
		db
			.update(inventoryReservations)
			.set({ status, updatedAt: now })
			.where(
				and(
					eq(inventoryReservations.id, id),
					eq(inventoryReservations.status, "active"),
				),
			),
		db
			.update(inventory)
			.set({
				reserved: reservedQuantity(reservation.productId, now),
				updatedAt: now,
			})
			.where(eq(inventory.productId, reservation.productId)),
	]);
	const [updated] = await db
		.select()
		.from(inventoryReservations)
		.where(eq(inventoryReservations.id, id))
		.limit(1);
	return updated ?? null;
}

export async function consumeInventoryReservation(
	db: CommerceDatabase,
	id: string,
	now = unixNow(),
) {
	const [reservation] = await db
		.select()
		.from(inventoryReservations)
		.where(eq(inventoryReservations.id, id))
		.limit(1);
	if (!reservation) return null;
	if (reservation.status === "consumed") return reservation;
	if (reservation.status !== "active" || reservation.expiresAt <= now) {
		throw new Error("Only active, unexpired reservations can be consumed");
	}

	const adjustmentId = generateCommerceId("adj");
	const referenceId = `reservation:${id}`;
	const adjustmentCandidate = db
		.select({
			id: sql<string>`${adjustmentId}`.as("id"),
			productId: inventoryReservations.productId,
			delta: sql<number>`-${inventoryReservations.quantity}`.as("delta"),
			reason: sql<string>`'reservation_consumed'`.as("reason"),
			referenceId: sql<string>`${referenceId}`.as("reference_id"),
			actorId: sql<string | null>`null`.as("actor_id"),
			createdAt: sql<number>`${now}`.as("created_at"),
		})
		.from(inventoryReservations)
		.where(
			and(
				eq(inventoryReservations.id, id),
				eq(inventoryReservations.status, "consumed"),
				sql`not exists (select 1 from ${inventoryAdjustments} where ${inventoryAdjustments.productId} = ${reservation.productId} and ${inventoryAdjustments.referenceId} = ${referenceId})`,
			),
		);

	await db.batch([
		db
			.update(inventoryReservations)
			.set({ status: "consumed", updatedAt: now })
			.where(
				and(
					eq(inventoryReservations.id, id),
					eq(inventoryReservations.status, "active"),
					gt(inventoryReservations.expiresAt, now),
				),
			),
		db.insert(inventoryAdjustments).select(adjustmentCandidate),
		db
			.update(inventory)
			.set({
				onHand: sql`${inventory.onHand} - ${reservation.quantity}`,
				reserved: reservedQuantity(reservation.productId, now),
				updatedAt: now,
			})
			.where(
				and(
					eq(inventory.productId, reservation.productId),
					sql`exists (select 1 from ${inventoryAdjustments} where ${inventoryAdjustments.id} = ${adjustmentId})`,
				),
			),
	]);

	const [updated] = await db
		.select()
		.from(inventoryReservations)
		.where(eq(inventoryReservations.id, id))
		.limit(1);
	if (updated?.status !== "consumed") {
		throw new Error("Reservation was not consumed");
	}
	return updated;
}

export async function expireInventoryReservations(
	db: CommerceDatabase,
	now = unixNow(),
): Promise<number> {
	const expired = await db
		.select({ productId: inventoryReservations.productId })
		.from(inventoryReservations)
		.where(
			and(
				eq(inventoryReservations.status, "active"),
				sql`${inventoryReservations.expiresAt} <= ${now}`,
			),
		);
	const productIds = [...new Set(expired.map((row) => row.productId))];
	if (productIds.length === 0) return 0;
	await db.batch([
		db
			.update(inventoryReservations)
			.set({ status: "expired", updatedAt: now })
			.where(
				and(
					eq(inventoryReservations.status, "active"),
					sql`${inventoryReservations.expiresAt} <= ${now}`,
				),
			),
		...productIds.map((productId) =>
			db
				.update(inventory)
				.set({ reserved: reservedQuantity(productId, now), updatedAt: now })
				.where(eq(inventory.productId, productId)),
		),
	]);
	return expired.length;
}
