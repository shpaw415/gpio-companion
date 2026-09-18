export const CART_STORAGE_KEY = "gpio-companion-marketplace-cart";
export const MIN_CART_QUANTITY = 1;
export const MAX_CART_QUANTITY = 10;

export type CartItem = { id: string; quantity: number };

function normalizeQuantity(value: unknown): number | null {
	if (typeof value !== "number" || !Number.isFinite(value)) return null;
	return Math.min(
		MAX_CART_QUANTITY,
		Math.max(MIN_CART_QUANTITY, Math.trunc(value)),
	);
}

export function normalizeCart(value: unknown): CartItem[] {
	if (!Array.isArray(value)) return [];
	const quantities = new Map<string, number>();
	for (const item of value) {
		if (!item || typeof item !== "object") continue;
		const { id, quantity } = item as Record<string, unknown>;
		if (typeof id !== "string" || !id.trim()) continue;
		const normalized = normalizeQuantity(quantity);
		if (normalized === null) continue;
		const cleanId = id.trim();
		quantities.set(
			cleanId,
			Math.min(MAX_CART_QUANTITY, (quantities.get(cleanId) ?? 0) + normalized),
		);
	}
	return [...quantities].map(([id, quantity]) => ({ id, quantity }));
}

export function parseCart(serialized: string | null | undefined): CartItem[] {
	if (!serialized) return [];
	try {
		return normalizeCart(JSON.parse(serialized));
	} catch {
		return [];
	}
}

export function updateCartItem(
	items: readonly CartItem[],
	id: string,
	quantity: number,
): CartItem[] {
	const cleanId = id.trim();
	if (!cleanId) return [...items];
	if (!Number.isFinite(quantity) || quantity < MIN_CART_QUANTITY) {
		return items.filter((item) => item.id !== cleanId);
	}
	const normalized = Math.min(MAX_CART_QUANTITY, Math.trunc(quantity));
	const exists = items.some((item) => item.id === cleanId);
	return exists
		? items.map((item) =>
				item.id === cleanId ? { id: cleanId, quantity: normalized } : item,
			)
		: [...items, { id: cleanId, quantity: normalized }];
}

export function cartCount(items: readonly CartItem[]): number {
	return items.reduce((total, item) => total + item.quantity, 0);
}
