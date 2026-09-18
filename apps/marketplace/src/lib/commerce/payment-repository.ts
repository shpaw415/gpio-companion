import { eq } from "drizzle-orm";
import type { CommerceDatabase } from "../db/client";
import { paymentEvents } from "../db/schema";
import { classifyReplay } from "./idempotency";
import { generateCommerceId, unixNow } from "./identifiers";

export interface PaymentEventInput {
	provider?: string;
	providerEventId: string;
	orderId?: string | null;
	eventType: string;
	payload: string;
}

function replayShape(event: PaymentEventInput) {
	return {
		provider: event.provider ?? "paypal",
		providerEventId: event.providerEventId,
		orderId: event.orderId ?? null,
		eventType: event.eventType,
		payload: event.payload,
	};
}

export async function recordPaymentEvent(
	db: CommerceDatabase,
	input: PaymentEventInput,
) {
	const [existing] = await db
		.select()
		.from(paymentEvents)
		.where(eq(paymentEvents.providerEventId, input.providerEventId))
		.limit(1);
	if (existing) {
		const decision = classifyReplay(replayShape(existing), replayShape(input));
		if (decision === "conflict") {
			throw new Error("Payment event ID was replayed with different content");
		}
		return { event: existing, replayed: true } as const;
	}

	const event = {
		id: generateCommerceId("payevt"),
		...replayShape(input),
		createdAt: unixNow(),
	};
	try {
		await db.insert(paymentEvents).values(event);
		return { event: { ...event, processedAt: null }, replayed: false } as const;
	} catch (error) {
		const [winner] = await db
			.select()
			.from(paymentEvents)
			.where(eq(paymentEvents.providerEventId, input.providerEventId))
			.limit(1);
		if (
			!winner ||
			classifyReplay(replayShape(winner), replayShape(input)) === "conflict"
		) {
			throw error;
		}
		return { event: winner, replayed: true } as const;
	}
}

export async function markPaymentEventProcessed(
	db: CommerceDatabase,
	providerEventId: string,
) {
	const [event] = await db
		.update(paymentEvents)
		.set({ processedAt: unixNow() })
		.where(eq(paymentEvents.providerEventId, providerEventId))
		.returning();
	return event ?? null;
}
