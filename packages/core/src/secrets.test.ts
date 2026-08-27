import { describe, expect, test } from "bun:test";
import { parseDeviceSecrets, secretsStatus } from "./secrets.ts";

describe("device secrets", () => {
	test("parses dashboard keys", () => {
		const secrets = parseDeviceSecrets({
			opencodeApiKey: " oc ",
			giteaToken: " gt ",
		});
		expect(secrets).toEqual({ opencodeApiKey: "oc", giteaToken: "gt" });
		expect(secretsStatus(secrets)).toEqual({
			opencodeApiKey: true,
			giteaToken: true,
			source: "dashboard",
		});
	});
});
