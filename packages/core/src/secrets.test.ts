import { describe, expect, test } from "bun:test";
import { parseDeviceSecrets, secretsStatus } from "./secrets.ts";

describe("device secrets", () => {
	test("parses gitea credentials for the pi api", () => {
		const secrets = parseDeviceSecrets({
			opencodeApiKey: " oc ",
			giteaUrl: " https://git.example.com ",
			giteaUsername: " ada ",
			giteaToken: " gt ",
		});
		expect(secrets.giteaUsername).toBe("ada");
		expect(secretsStatus(secrets)).toEqual({
			opencodeApiKey: true,
			giteaUrl: true,
			giteaUsername: true,
			giteaToken: true,
			giteaReady: true,
			source: "device-api",
		});
	});
});
