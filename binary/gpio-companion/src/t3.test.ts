import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetT3Runtime, t3Status } from "./t3.ts";

const previousT3 = process.env.GPIO_COMPANION_T3;
const previousUser = process.env.GPIO_USER;

afterEach(() => {
	resetT3Runtime();
	if (previousT3 === undefined) {
		delete process.env.GPIO_COMPANION_T3;
	} else {
		process.env.GPIO_COMPANION_T3 = previousT3;
	}
	if (previousUser === undefined) {
		delete process.env.GPIO_USER;
	} else {
		process.env.GPIO_USER = previousUser;
	}
});

async function fakeT3(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "gpio-t3-"));
	const log = join(dir, "t3.log");
	const bin = join(dir, "t3");
	await mkdir(dir, { recursive: true });
	await Bun.write(
		bin,
		`#!/bin/sh
printf '%s\\n' "$*" >> "$GPIO_T3_LOG"
case "$1" in
  service) echo active ;;
  auth) echo "no sessions" ;;
  *) echo ok ;;
esac
`,
	);
	await chmod(bin, 0o755);
	process.env.GPIO_COMPANION_T3 = bin;
	process.env.GPIO_T3_LOG = log;
	process.env.GPIO_USER = "root";
	return log;
}

function invocations(log: string): string[] {
	return log
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

describe("t3 status cache", () => {
	test("single-flight and cache avoid stacked t3 cli", async () => {
		const logPath = await fakeT3();
		resetT3Runtime();
		await Promise.all([t3Status(), t3Status(), t3Status()]);
		const first = invocations(await readFile(logPath, "utf8"));
		expect(first.filter((line) => line.startsWith("auth")).length).toBe(1);
		expect(
			first.filter((line) => line.startsWith("service")).length,
		).toBeLessThanOrEqual(1);
		await t3Status();
		const second = invocations(await readFile(logPath, "utf8"));
		expect(second).toEqual(first);
	});
});
