import { afterAll, describe, expect, test } from "bun:test";
import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	utimes,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "cleanup-script.sh");
const dirs: string[] = [];

async function tempDir() {
	const dir = await mkdtemp(join(tmpdir(), "gpio-cleanup-"));
	dirs.push(dir);
	return dir;
}

afterAll(async () => {
	await Promise.all(
		dirs.map((dir) => rm(dir, { recursive: true, force: true })),
	);
});

async function bash(body: string, env: Record<string, string> = {}) {
	const proc = Bun.spawn(["bash", "-ec", body], {
		stdout: "pipe",
		stderr: "pipe",
		env: { ...process.env, ...env },
	});
	const [stdout, stderr, exit] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { stdout, stderr, exit };
}

describe("gpio-companion cleanup", () => {
	test("deletes old files and keeps protected plus fresh ones", async () => {
		const root = await tempDir();
		const now = 1_700_000_000;
		const old = now - 90_000;
		const fresh = now - 60;
		await mkdir(join(root, "tmp"), { recursive: true });
		await mkdir(join(root, "etc/gpio-companion"), { recursive: true });
		await mkdir(join(root, "opt/gpio-companion"), { recursive: true });
		await writeFile(join(root, "tmp/old.log"), "stale");
		await writeFile(join(root, "tmp/new.log"), "keep");
		await writeFile(join(root, "etc/gpio-companion/secrets.env"), "secret");
		await writeFile(join(root, "opt/gpio-companion/file"), "repo");
		await utimes(join(root, "tmp/old.log"), old, old);
		await utimes(join(root, "tmp/new.log"), fresh, fresh);
		await utimes(join(root, "etc/gpio-companion/secrets.env"), old, old);
		await utimes(join(root, "opt/gpio-companion/file"), old, old);

		const result = await bash(
			`source "${script}"
gpio_cleanup_main
test ! -f "${root}/tmp/old.log"
test -f "${root}/tmp/new.log"
test -f "${root}/etc/gpio-companion/secrets.env"
test -f "${root}/opt/gpio-companion/file"
`,
			{
				GPIO_COMPANION_CLEANUP_ROOT: root,
				GPIO_COMPANION_CLEANUP_NOW: String(now),
				GPIO_COMPANION_CLEANUP_AGE_SEC: "86400",
				GPIO_COMPANION_CLEANUP_DRY: "0",
				GPIO_COMPANION_DASHBOARD_URL: "http://127.0.0.1:9",
			},
		);
		expect(result.exit).toBe(0);
		expect(result.stderr).toBe("");
		const report = JSON.parse(
			await readFile(
				join(root, "var/lib/gpio-companion/cleanup-last.json"),
				"utf8",
			),
		) as { reclaimedBytes: number; actions: string[] };
		expect(report.reclaimedBytes).toBeGreaterThan(0);
		expect(report.actions).toContain("prune:/tmp");
	});

	test("dry-run does not delete", async () => {
		const root = await tempDir();
		const now = 1_700_000_000;
		await mkdir(join(root, "tmp"), { recursive: true });
		await writeFile(join(root, "tmp/old.log"), "stale");
		await utimes(join(root, "tmp/old.log"), now - 90_000, now - 90_000);
		const result = await bash(`source "${script}"; gpio_cleanup_main`, {
			GPIO_COMPANION_CLEANUP_ROOT: root,
			GPIO_COMPANION_CLEANUP_NOW: String(now),
			GPIO_COMPANION_CLEANUP_DRY: "1",
		});
		expect(result.exit).toBe(0);
		expect(await readFile(join(root, "tmp/old.log"), "utf8")).toBe("stale");
	});
});
