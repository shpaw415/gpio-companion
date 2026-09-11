import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addT3Project, pairT3, resetT3Runtime, t3Status } from "./t3.ts";

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

async function fakeT3(script?: string): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "gpio-t3-"));
	const log = join(dir, "t3.log");
	const bin = join(dir, "t3");
	await mkdir(dir, { recursive: true });
	await Bun.write(
		bin,
		script ??
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

describe("t3 pair", () => {
	test("mints with auth pairing create", async () => {
		const logPath = await fakeT3(`#!/bin/sh
printf '%s\\n' "$*" >> "$GPIO_T3_LOG"
printf 'XDG=%s\\n' "$XDG_RUNTIME_DIR" >> "$GPIO_T3_ENV"
case "$1" in
  pair) echo failed >&2; exit 1 ;;
  auth)
    if [ "$2" = "pairing" ]; then
      echo "Token: mint-token"
      echo "Pairing URL: https://127.0.0.1/pair#token=mint-token"
      exit 0
    fi
    echo "no sessions"
    ;;
  service) echo active ;;
  *) echo ok ;;
esac
`);
		const envLog = join(logPath, "..", "t3.env");
		process.env.GPIO_T3_ENV = envLog;
		resetT3Runtime();
		const paired = await pairT3("t3.example.gpio-companion.com");
		expect(paired.pairingToken).toBe("mint-token");
		expect(paired.pairingUrl).toBe(
			"https://t3.example.gpio-companion.com/pair#token=mint-token",
		);
		const calls = invocations(await readFile(logPath, "utf8"));
		expect(calls.some((line) => line === "pair")).toBe(false);
		expect(calls.some((line) => line.startsWith("auth pairing create"))).toBe(
			true,
		);
		expect(await readFile(envLog, "utf8")).toContain("XDG=/run/user/0");
	});

	test("falls back to t3 pair when mint prints no token", async () => {
		const logPath = await fakeT3(`#!/bin/sh
printf '%s\\n' "$*" >> "$GPIO_T3_LOG"
case "$1" in
  pair)
    echo "Token: pair-token"
    echo "Pairing URL: https://127.0.0.1/pair#token=pair-token"
    ;;
  auth)
    echo failed >&2
    exit 1
    ;;
  *) echo ok ;;
esac
`);
		resetT3Runtime();
		const paired = await pairT3("t3.example.gpio-companion.com");
		expect(paired.pairingToken).toBe("pair-token");
		const calls = invocations(await readFile(logPath, "utf8"));
		expect(calls.some((line) => line.startsWith("auth pairing create"))).toBe(
			true,
		);
		expect(calls.some((line) => line === "pair")).toBe(true);
	});

	test("keeps pairing token when t3 exits non-zero after printing", async () => {
		await fakeT3(`#!/bin/sh
printf '%s\\n' "$*" >> "$GPIO_T3_LOG"
case "$1" in
  auth)
    if [ "$2" = "pairing" ]; then
      echo "Token: killed-token"
      echo "Pairing URL: https://127.0.0.1/pair#token=killed-token"
      exit 143
    fi
    echo "no sessions"
    ;;
  *) echo ok ;;
esac
`);
		resetT3Runtime();
		const paired = await pairT3("t3.example.gpio-companion.com");
		expect(paired.pairingToken).toBe("killed-token");
	});

	test("single-flight pair does not stack t3 cli", async () => {
		const logPath = await fakeT3(`#!/bin/sh
printf '%s\\n' "$*" >> "$GPIO_T3_LOG"
case "$1" in
  auth)
    if [ "$2" = "pairing" ]; then
      echo "Token: once"
      echo "Pairing URL: https://127.0.0.1/pair#token=once"
    fi
    ;;
  pair)
    echo "Token: once"
    echo "Pairing URL: https://127.0.0.1/pair#token=once"
    ;;
  *) echo ok ;;
esac
`);
		resetT3Runtime();
		const [first, second] = await Promise.all([
			pairT3("t3.example.gpio-companion.com"),
			pairT3("t3.example.gpio-companion.com"),
		]);
		expect(first.pairingToken).toBe("once");
		expect(second.pairingToken).toBe("once");
		const calls = invocations(await readFile(logPath, "utf8"));
		expect(
			calls.filter((line) => line.startsWith("auth pairing create")),
		).toHaveLength(1);
	});
});

describe("t3 project add", () => {
	test("adds a workspace root", async () => {
		const logPath = await fakeT3();
		expect(await addT3Project("/home/companion/projects/blink", "blink")).toBe(
			"added",
		);
		const calls = invocations(await readFile(logPath, "utf8"));
		expect(
			calls.some(
				(line) =>
					line.includes("project add") &&
					line.includes("/home/companion/projects/blink"),
			),
		).toBe(true);
	});

	test("treats already exists as success", async () => {
		await fakeT3(`#!/bin/sh
printf '%s\\n' "$*" >> "$GPIO_T3_LOG"
echo "An active project already exists for '/tmp/blink'." >&2
exit 1
`);
		expect(await addT3Project("/tmp/blink")).toBe("exists");
	});
});
