import {
	type DeviceAuthHeaders,
	normalizeDevicePath,
	signDeviceRequest,
} from "./device-auth.ts";

export const BLE_SERVICE_UUID = "a1c15e00-6f10-4c9a-9c31-47b0c15e0001";
export const BLE_INFO_UUID = "a1c15e00-6f10-4c9a-9c31-47b0c15e0002";
export const BLE_CMD_UUID = "a1c15e00-6f10-4c9a-9c31-47b0c15e0003";
export const BLE_STATUS_UUID = "a1c15e00-6f10-4c9a-9c31-47b0c15e0004";
export const BLE_DEVICE_NAME = "gpio-companion";
export const BLE_CHUNK_SIZE = 160;

export type SignedDeviceEnvelope = {
	method: string;
	path: string;
	body: string;
	headers: DeviceAuthHeaders;
};

export type BleInfo = {
	uuid: string;
	hardware: string;
	name: string;
	deviceUrl?: string;
};

export async function createSignedEnvelope(options: {
	privateKeyPem: string;
	keyId: string;
	method: string;
	path: string;
	body?: string;
}): Promise<SignedDeviceEnvelope> {
	const body = options.body ?? "";
	const method = options.method.toUpperCase();
	const path = normalizeDevicePath(options.path);
	const headers = await signDeviceRequest({
		privateKeyPem: options.privateKeyPem,
		keyId: options.keyId,
		method,
		path,
		body,
	});
	return { method, path, body, headers };
}

export function parseSignedEnvelope(input: unknown): SignedDeviceEnvelope {
	if (input === null || typeof input !== "object") {
		throw new Error("envelope must be an object");
	}
	const record = input as Record<string, unknown>;
	const method = requiredString(record.method, "method").toUpperCase();
	const path = normalizeDevicePath(requiredString(record.path, "path"));
	const body = typeof record.body === "string" ? record.body : "";
	const headers = record.headers;
	if (headers === null || typeof headers !== "object") {
		throw new Error("headers are required");
	}
	const headerRecord = headers as Record<string, unknown>;
	const keyId = requiredString(
		headerRecord["X-Gpio-Key-Id"] ?? headerRecord["x-gpio-key-id"],
		"X-Gpio-Key-Id",
	);
	const timestamp = requiredString(
		headerRecord["X-Gpio-Timestamp"] ?? headerRecord["x-gpio-timestamp"],
		"X-Gpio-Timestamp",
	);
	const nonce = requiredString(
		headerRecord["X-Gpio-Nonce"] ?? headerRecord["x-gpio-nonce"],
		"X-Gpio-Nonce",
	);
	const signature = requiredString(
		headerRecord["X-Gpio-Signature"] ?? headerRecord["x-gpio-signature"],
		"X-Gpio-Signature",
	);
	return {
		method,
		path,
		body,
		headers: {
			"X-Gpio-Key-Id": keyId,
			"X-Gpio-Timestamp": timestamp,
			"X-Gpio-Nonce": nonce,
			"X-Gpio-Signature": signature,
		},
	};
}

export function envelopeToRequest(
	envelope: SignedDeviceEnvelope,
	origin = "http://127.0.0.1",
): Request {
	return new Request(`${origin}${envelope.path}`, {
		method: envelope.method,
		headers: {
			"content-type": "application/json",
			...envelope.headers,
		},
		body: envelope.body || undefined,
	});
}

export function envelopeToPasteText(envelope: SignedDeviceEnvelope): string {
	return JSON.stringify(envelope);
}

export function splitBleFrames(
	payload: string,
	mtu = BLE_CHUNK_SIZE,
): Uint8Array[] {
	const body = new TextEncoder().encode(payload);
	const all = new Uint8Array(4 + body.length);
	new DataView(all.buffer).setUint32(0, body.length);
	all.set(body, 4);
	const frames: Uint8Array[] = [];
	for (let offset = 0; offset < all.length; offset += mtu) {
		frames.push(all.slice(offset, offset + mtu));
	}
	return frames;
}

export function createBleAssembler(): {
	push(chunk: Uint8Array): string | null;
	reset(): void;
} {
	let buf = new Uint8Array(0);
	return {
		push(chunk: Uint8Array) {
			const next = new Uint8Array(buf.length + chunk.length);
			next.set(buf);
			next.set(chunk, buf.length);
			buf = next;
			if (buf.length === 0) {
				return null;
			}
			if (buf[0] === 0x7b) {
				try {
					const text = new TextDecoder().decode(buf).trim();
					JSON.parse(text);
					buf = new Uint8Array(0);
					return text;
				} catch {
					return null;
				}
			}
			if (buf.length < 4) {
				return null;
			}
			const length = new DataView(
				buf.buffer,
				buf.byteOffset,
				buf.byteLength,
			).getUint32(0);
			if (buf.length < 4 + length) {
				return null;
			}
			const text = new TextDecoder().decode(buf.slice(4, 4 + length));
			buf = buf.slice(4 + length);
			return text;
		},
		reset() {
			buf = new Uint8Array(0);
		},
	};
}

function requiredString(value: unknown, field: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${field} is required`);
	}
	return value.trim();
}
