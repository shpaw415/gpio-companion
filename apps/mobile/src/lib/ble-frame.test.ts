import { describe, expect, test } from "bun:test";
import {
	BLE_CHUNK_SIZE,
	BLE_DEVICE_NAME,
	BLE_SERVICE_UUID,
	encodeFrames,
	matchesBoard,
	toBase64,
} from "./ble-frame.ts";

function decodeBase64(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

describe("toBase64", () => {
	test("round-trips bytes", () => {
		const text = '{"uuid":"a1c15e00"}';
		const bytes = new TextEncoder().encode(text);
		expect(new TextDecoder().decode(decodeBase64(toBase64(bytes)))).toBe(text);
	});
});

describe("encodeFrames", () => {
	test("small payload fits one frame with a length prefix", () => {
		const payload = '{"hello":"world"}';
		const frames = encodeFrames(payload);
		expect(frames.length).toBe(1);
		const bytes = decodeBase64(frames[0]);
		expect(new DataView(bytes.buffer).getUint32(0)).toBe(payload.length);
		expect(new TextDecoder().decode(bytes.slice(4))).toBe(payload);
	});

	test("large payload splits into length-prefixed chunks", () => {
		const payload = "x".repeat(1_000);
		const frames = encodeFrames(payload);
		expect(frames.length).toBe(Math.ceil((4 + payload.length) / BLE_CHUNK_SIZE));
		const joined: number[] = [];
		for (const frame of frames) {
			for (const byte of decodeBase64(frame)) {
				joined.push(byte);
			}
		}
		const view = new DataView(new Uint8Array(joined).buffer);
		expect(view.getUint32(0)).toBe(payload.length);
		expect(new TextDecoder().decode(new Uint8Array(joined.slice(4)))).toBe(payload);
	});
});

describe("matchesBoard", () => {
	test("matches the advertised name prefix", () => {
		expect(matchesBoard(`${BLE_DEVICE_NAME}-1`, [])).toBe(true);
		expect(matchesBoard("gpio", [])).toBe(true);
		expect(matchesBoard("GPIO", [])).toBe(true);
		expect(matchesBoard("", [])).toBe(false);
	});

	test("matches the service uuid case-insensitively", () => {
		expect(matchesBoard("", [BLE_SERVICE_UUID])).toBe(true);
		expect(matchesBoard("", [BLE_SERVICE_UUID.toUpperCase()])).toBe(true);
	});

	test("ignores other devices", () => {
		expect(matchesBoard("Samsung TV", ["0000abcd-0000-0000-0000-000000000000"])).toBe(false);
	});
});
