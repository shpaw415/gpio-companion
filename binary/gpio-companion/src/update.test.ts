import { describe, expect, test } from "bun:test";
import { applySystemdUpdate, UPDATE_UNIT } from "./update.ts";

describe("applySystemdUpdate", () => {
	test("starts the update unit without blocking", async () => {
		const previous = process.env.GPIO_COMPANION_SYSTEMCTL;
		process.env.GPIO_COMPANION_SYSTEMCTL = "systemctl";
		const seen: string[][] = [];
		const apply = applySystemdUpdate((cmd) => {
			seen.push(cmd as string[]);
			return {
				stderr: new ReadableStream({
					start(controller) {
						controller.close();
					},
				}),
				exited: Promise.resolve(0),
			} as ReturnType<typeof Bun.spawn>;
		});
		try {
			await apply();
		} finally {
			if (previous === undefined) {
				delete process.env.GPIO_COMPANION_SYSTEMCTL;
			} else {
				process.env.GPIO_COMPANION_SYSTEMCTL = previous;
			}
		}
		expect(seen).toEqual([["systemctl", "start", "--no-block", UPDATE_UNIT]]);
	});

	test("surfaces a failed systemctl start", async () => {
		const previous = process.env.GPIO_COMPANION_SYSTEMCTL;
		process.env.GPIO_COMPANION_SYSTEMCTL = "systemctl";
		const apply = applySystemdUpdate(() => {
			return {
				stderr: new Blob(["unit missing\n"]).stream(),
				exited: Promise.resolve(1),
			} as ReturnType<typeof Bun.spawn>;
		});
		try {
			await expect(apply()).rejects.toThrow("unit missing");
		} finally {
			if (previous === undefined) {
				delete process.env.GPIO_COMPANION_SYSTEMCTL;
			} else {
				process.env.GPIO_COMPANION_SYSTEMCTL = previous;
			}
		}
	});
});
