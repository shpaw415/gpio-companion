import { describe, expect, test } from "bun:test";
import {
	DeviceAuthError,
	generateDeviceKeyPair,
	publicKeyPemFromPrivateKey,
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

	test("flags a valid signature when the local clock is behind", async () => {
		const keys = await generateDeviceKeyPair();
		const now = 1_700_000_000_000;
		const issued = now + 120_000;
		const headers = await signDeviceRequest({
			privateKeyPem: keys.privateKeyPem,
			keyId: keys.keyId,
			method: "GET",
			path: "/v1/status",
			now: issued,
		});
		const result = await verifyDeviceRequest({
			publicKeyPem: keys.publicKeyPem,
			keyId: keys.keyId,
			method: "GET",
			path: "/v1/status",
			headers,
			now,
		});
		expect(result).toEqual({
			issued,
			nonce: headers["X-Gpio-Nonce"],
			clockBehind: true,
		});
	});

	test("accepts a stale timestamp when skew is not enforced", async () => {
		const keys = await generateDeviceKeyPair();
		const headers = await signDeviceRequest({
			privateKeyPem: keys.privateKeyPem,
			keyId: keys.keyId,
			method: "GET",
			path: "/v1/pairing/credentials",
			now: Date.now() - 120_000,
			nonce: "offline-nonce-1",
		});
		const result = await verifyDeviceRequest({
			publicKeyPem: keys.publicKeyPem,
			keyId: keys.keyId,
			method: "GET",
			path: "/v1/pairing/credentials",
			headers,
			enforceSkew: false,
		});
		expect(result).toEqual({
			issued: Number(headers["X-Gpio-Timestamp"]),
			nonce: "offline-nonce-1",
			clockBehind: false,
		});
	});

	test("rejects an invalid signature before treating a future timestamp as clock skew", async () => {
		const keys = await generateDeviceKeyPair();
		const headers = await signDeviceRequest({
			privateKeyPem: keys.privateKeyPem,
			keyId: keys.keyId,
			method: "GET",
			path: "/v1/status",
			now: Date.now() + 120_000,
		});
		headers["X-Gpio-Signature"] = btoa("not-a-real-signature");
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
				"invalid device signature",
			);
		}
	});

	test("derives the public PEM from the private PEM", async () => {
		const keys = await generateDeviceKeyPair();
		const derived = await publicKeyPemFromPrivateKey(keys.privateKeyPem);
		expect(derived).toBe(keys.publicKeyPem);
		const headers = await signDeviceRequest({
			privateKeyPem: keys.privateKeyPem,
			keyId: keys.keyId,
			method: "GET",
			path: "/v1/status",
		});
		await verifyDeviceRequest({
			publicKeyPem: derived,
			keyId: keys.keyId,
			method: "GET",
			path: "/v1/status",
			headers,
		});
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
