import { describe, expect, test } from "bun:test";
import {
	createBleAssembler,
	createSignedEnvelope,
	envelopeToPasteText,
	isBleCompleteStatus,
	isBleIdleStatus,
	isBlePartialSnapshot,
	isBleSettledStatus,
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

	test("treats ready true as idle status", () => {
		expect(isBleIdleStatus('{"ready":true}')).toBe(true);
		expect(isBleIdleStatus('{"pending":true}')).toBe(true);
		expect(isBleIdleStatus("")).toBe(true);
		expect(isBleIdleStatus('{"error":"missing device signature"}')).toBe(false);
		expect(isBleIdleStatus('{"running":false}')).toBe(false);
	});

	test("complete status waits for valid non-idle json", () => {
		expect(isBleCompleteStatus('{"ready":true}')).toBe(false);
		expect(isBleCompleteStatus('{"pending":true}')).toBe(false);
		expect(isBleCompleteStatus("")).toBe(false);
		expect(isBleCompleteStatus('{"hardware":"orangepi","pins":[')).toBe(false);
		expect(isBleCompleteStatus('{"error":"missing device signature"}')).toBe(
			true,
		);
		expect(
			isBleCompleteStatus('{"hardware":"orangepi","pins":[{"physical":1}]}'),
		).toBe(true);
		expect(
			isBlePartialSnapshot('{"hardware":"orangepi","pins":[{"physical":1'),
		).toBe(true);
		expect(
			isBlePartialSnapshot(
				'{"dashboardUrl":"https://gpio-companion.com","deviceAuth":{"keyId":"gpio',
			),
		).toBe(true);
		expect(isBlePartialSnapshot('{"running":false}')).toBe(false);
		expect(
			isBleSettledStatus('{"hardware":"orangepi","pins":[{"physical":1'),
		).toBe(true);
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
