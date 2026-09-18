function randomHex(byteLength: number): string {
	const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

export function generateCommerceId(prefix: string): string {
	if (!/^[a-z][a-z0-9]*$/.test(prefix)) {
		throw new Error(
			"ID prefix must contain lowercase ASCII letters and digits",
		);
	}
	return `${prefix}_${randomHex(16)}`;
}

export function generateOrderIdentity(now = new Date()): {
	id: string;
	orderNumber: string;
} {
	if (Number.isNaN(now.getTime())) throw new Error("Invalid order date");
	const date = now.toISOString().slice(0, 10).replaceAll("-", "");
	return {
		id: generateCommerceId("ord"),
		orderNumber: `GC-${date}-${randomHex(5).toUpperCase()}`,
	};
}

export function unixNow(): number {
	return Math.floor(Date.now() / 1000);
}
