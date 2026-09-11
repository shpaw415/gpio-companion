import { describe, expect, test } from "bun:test";
import { privileged } from "./priv.ts";

describe("privileged", () => {
	test("prefixes sudo -n when not root", () => {
		if (typeof process.getuid === "function" && process.getuid() === 0) {
			expect(privileged(["systemctl", "start", "x"])).toEqual([
				"systemctl",
				"start",
				"x",
			]);
			return;
		}
		expect(privileged(["systemctl", "start", "x"])).toEqual([
			"sudo",
			"-n",
			"--",
			"systemctl",
			"start",
			"x",
		]);
	});
});
