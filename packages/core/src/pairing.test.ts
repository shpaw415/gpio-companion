import { describe, expect, test } from "bun:test";
import { loginFromEmail, parsePairingClaim, publicPairing } from "./pairing.ts";

describe("pairing", () => {
	test("maps email to login", () => {
		expect(loginFromEmail("ada@gpio-companion.com")).toBe("ada");
	});

	test("parses a claim", () => {
		const claim = parsePairingClaim({
			uuid: " u1 ",
			key: " k1 ",
			userId: "user-1",
			email: "ada@gpio-companion.com",
		});
		expect(claim.login).toBe("ada");
		expect(
			publicPairing({ ...claim, claimed: true, claimedAt: "now", key: "k1" })
				.paired,
		).toBe(true);
	});
});
