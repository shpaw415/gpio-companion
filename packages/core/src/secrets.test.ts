import { describe, expect, test } from "bun:test";
import { parseDeviceSecrets, secretsStatus } from "./secrets.ts";

describe("device secrets", () => {
	test("parses github credentials for the pi api", () => {
		const secrets = parseDeviceSecrets({
			gpioAiKey: " ai ",
			githubUsername: " ada ",
			githubToken: " gh ",
		});
		expect(secrets.githubUsername).toBe("ada");
		expect(secrets.githubUrl).toBe("https://github.com");
		expect(secretsStatus(secrets)).toEqual({
			gpioAiKey: true,
			githubUsername: true,
			githubToken: true,
			githubUrl: true,
			githubReady: true,
			source: "device-api",
		});
	});

	test("reads legacy gitea field names", () => {
		const secrets = parseDeviceSecrets({
			giteaUsername: " ada ",
			giteaToken: " gt ",
			giteaUrl: " https://git.example.com ",
		});
		expect(secrets.githubUsername).toBe("ada");
		expect(secrets.githubToken).toBe("gt");
		expect(secrets.githubUrl).toBe("https://git.example.com");
		expect(secretsStatus(secrets).githubReady).toBe(true);
	});
});
