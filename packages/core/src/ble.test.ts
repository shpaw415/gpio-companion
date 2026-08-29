import { describe, expect, test } from "bun:test";
import {
	createBleAssembler,
	createSignedEnvelope,
	envelopeToPasteText,
	parseSignedEnvelope,
	splitBleFrames,
} from "./ble.ts";
import { generateDeviceKeyPair, verifyDeviceRequest } from "./device-auth.ts";

describe("ble", () => {
	test("chunks and reassembles a payload", () => {
		const payload = JSON.stringify({ hello: "world".repeat(40) });
		const frames = splitBleFrames(payload, 32);
		expect(frames.length).toBeGreaterThan(1);
		const assembler = createBleAssembler();
		let result: string | null = null;
		for (const frame of frames) {
			result = assembler.push(frame);
		}
		expect(result).toBe(payload);
	});

	test("accepts pasted utf-8 json from a ble text app", () => {
		const payload = JSON.stringify({
			method: "PUT",
			path: "/v1/config/wifi",
			body: "{}",
			headers: {
				"X-Gpio-Key-Id": "gpio-companion-v1",
				"X-Gpio-Timestamp": "1",
				"X-Gpio-Nonce": "n",
				"X-Gpio-Signature": "s",
			},
		});
		const assembler = createBleAssembler();
		expect(
			assembler.push(new TextEncoder().encode(payload.slice(0, 20))),
		).toBeNull();
		expect(assembler.push(new TextEncoder().encode(payload.slice(20)))).toBe(
			payload,
		);
	});

	test("signed envelope verifies like an http device request", async () => {
		const keys = await generateDeviceKeyPair();
		const body = JSON.stringify({
			ssid: "bench",
			psk: "secret-pass",
			uuid: "pair-uuid",
		});
		const envelope = await createSignedEnvelope({
			privateKeyPem: keys.privateKeyPem,
			keyId: keys.keyId,
			method: "PUT",
			path: "/v1/config/wifi",
			body,
		});
		expect(JSON.parse(envelopeToPasteText(envelope))).toEqual(envelope);
		const parsed = parseSignedEnvelope(envelope);
		await verifyDeviceRequest({
			publicKeyPem: keys.publicKeyPem,
			keyId: keys.keyId,
			method: parsed.method,
			path: parsed.path,
			body: parsed.body,
			headers: parsed.headers,
		});
	});
});
