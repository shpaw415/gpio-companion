import { describe, expect, test } from "bun:test";
import {
	DeviceAuthError,
	generateDeviceKeyPair,
	signDeviceRequest,
	verifyDeviceRequest,
} from "./device-auth.ts";

describe("device-auth", () => {
	test("signs and verifies an Ed25519 request", async () => {
		const keys = await generateDeviceKeyPair();
		const body = JSON.stringify({ token: "tunnel-token" });
		const headers = await signDeviceRequest({
			privateKeyPem: keys.privateKeyPem,
			keyId: keys.keyId,
			method: "PUT",
			path: "/v1/config/tunnel",
			body,
		});
		await verifyDeviceRequest({
			publicKeyPem: keys.publicKeyPem,
			keyId: keys.keyId,
			method: "PUT",
			path: "/v1/config/tunnel",
			body,
			headers,
		});
	});

	test("rejects a missing signature", async () => {
		const keys = await generateDeviceKeyPair();
		try {
			await verifyDeviceRequest({
				publicKeyPem: keys.publicKeyPem,
				keyId: keys.keyId,
				method: "GET",
				path: "/v1/status",
				headers: {},
			});
			throw new Error("expected failure");
		} catch (error) {
			expect(error).toBeInstanceOf(DeviceAuthError);
			expect((error as DeviceAuthError).status).toBe(401);
		}
	});

	test("rejects an expired signature", async () => {
		const keys = await generateDeviceKeyPair();
		const headers = await signDeviceRequest({
			privateKeyPem: keys.privateKeyPem,
			keyId: keys.keyId,
			method: "GET",
			path: "/v1/status",
			now: Date.now() - 120_000,
		});
		try {
			await verifyDeviceRequest({
				publicKeyPem: keys.publicKeyPem,
				keyId: keys.keyId,
				method: "GET",
				path: "/v1/status",
				headers,
			});
			throw new Error("expected failure");
		} catch (error) {
			expect(error).toBeInstanceOf(DeviceAuthError);
			expect((error as DeviceAuthError).message).toBe(
				"expired device signature",
			);
		}
	});

	test("rejects a signature from another key", async () => {
		const signer = await generateDeviceKeyPair();
		const other = await generateDeviceKeyPair();
		const headers = await signDeviceRequest({
			privateKeyPem: signer.privateKeyPem,
			keyId: signer.keyId,
			method: "PUT",
			path: "/v1/config/secrets",
			body: "{}",
		});
		try {
			await verifyDeviceRequest({
				publicKeyPem: other.publicKeyPem,
				keyId: signer.keyId,
				method: "PUT",
				path: "/v1/config/secrets",
				body: "{}",
				headers,
			});
			throw new Error("expected failure");
		} catch (error) {
			expect(error).toBeInstanceOf(DeviceAuthError);
			expect((error as DeviceAuthError).status).toBe(403);
		}
	});
});
