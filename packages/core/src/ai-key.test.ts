import { describe, expect, test } from "bun:test";
import { hashAiKey } from "./ai-key.ts";

describe("ai key", () => {
	test("hashes a gpio ai key", async () => {
		const hash = await hashAiKey("secret");
		expect(hash).toHaveLength(64);
		expect(await hashAiKey("secret")).toBe(hash);
		expect(await hashAiKey("other")).not.toBe(hash);
	});
});
