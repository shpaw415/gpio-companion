import { getContext } from "@next/action/context";
import { commerceDb, requireUser } from "../../lib/admin-auth.ts";
import {
	orderForCapture,
	reservationsForOrder,
} from "../../lib/commerce/checkout.ts";
import {
	listOrdersForUser,
	updateOrderStates,
} from "../../lib/commerce/order-repository.ts";
import { consumeInventoryReservation } from "../../lib/commerce/reservation-repository.ts";
import { captureMatches, capturePayPalOrder } from "../../lib/paypal.ts";

export async function GET() {
	const ctx = getContext<Env, never, never>(arguments);
	const session = await requireUser(ctx);
	return listOrdersForUser(commerceDb(ctx), session.id ?? "");
}

export async function POST(orderId: string) {
	const ctx = getContext<Env, never, never>(arguments);
	const session = await requireUser(ctx);
	const db = commerceDb(ctx);
	const order = await orderForCapture(db, orderId);
	if (!order || order.userId !== session.id) throw new Error("Order not found");
	if (order.paymentStatus === "captured") {
		return { orderId: order.id, paymentStatus: order.paymentStatus };
	}
	if (!order.paypalOrderId) throw new Error("PayPal order is missing");
	const captured = await capturePayPalOrder(
		ctx.env,
		order.paypalOrderId,
		`capture:${order.id}`,
	);
	const match = captureMatches(captured, order.totalCents);
	if (!match) throw new Error("PayPal capture did not match the order total");
	const reservations = await reservationsForOrder(db, order.id);
	for (const reservation of reservations) {
		if (reservation.status === "active") {
			await consumeInventoryReservation(db, reservation.id);
		}
	}
	await updateOrderStates(db, order.id, {
		status: "confirmed",
		paymentStatus: "captured",
		paypalCaptureId: match.captureId,
	});
	return { orderId: order.id, paymentStatus: "captured" as const };
}
