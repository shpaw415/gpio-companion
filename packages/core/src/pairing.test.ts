import { describe, expect, test } from "bun:test";
import {
	giteaLoginFromEmail,
	parsePairingClaim,
	publicPairing,
} from "./pairing.ts";

describe("pairing", () => {
	test("maps email to gitea login", () => {
		expect(giteaLoginFromEmail("ada@gpio-companion.com")).toBe("ada");
	});

	test("parses a claim", () => {
		const claim = parsePairingClaim({
			uuid: " u1 ",
			key: " k1 ",
			userId: "user-1",
			email: "ada@gpio-companion.com",
		});
		expect(claim.giteaLogin).toBe("ada");
		expect(
			publicPairing({ ...claim, claimed: true, claimedAt: "now", key: "k1" })
				.paired,
		).toBe(true);
	});
});
