import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const libSh = join(import.meta.dir, "lib.sh");
const dirs: string[] = [];
let gitconfig = "";

function gitEnv(): Record<string, string> {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value === undefined || key.startsWith("GIT_")) {
			continue;
		}
		env[key] = value;
	}
	env.GIT_AUTHOR_NAME = "test";
	env.GIT_AUTHOR_EMAIL = "test@example.com";
	env.GIT_COMMITTER_NAME = "test";
	env.GIT_COMMITTER_EMAIL = "test@example.com";
	env.GIT_CONFIG_NOSYSTEM = "1";
	env.GIT_CONFIG_GLOBAL = gitconfig;
	env.GIT_PROTOCOL_FROM_USER = "1";
	return env;
}

async function tempDir() {
	const dir = await mkdtemp(join(tmpdir(), "gpio-git-"));
	dirs.push(dir);
	return dir;
}

async function bash(script: string) {
	const proc = Bun.spawn(["bash", "-ec", script], {
		stdout: "pipe",
		stderr: "pipe",
		env: gitEnv(),
	});
	const [stdout, stderr, exit] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { stdout, stderr, exit };
}

async function setupPair() {
	const dir = await tempDir();
	const origin = join(dir, "origin");
	const clone = join(dir, "clone");
	const setup = await bash(`
git -c protocol.file.allow=always init -b main "${origin}"
echo one > "${origin}/file"
git -C "${origin}" add file
git -C "${origin}" -c user.name=test -c user.email=test@example.com commit --no-gpg-sign -m one
git -c protocol.file.allow=always clone --depth 1 "file://${origin}" "${clone}"
`);
	if (setup.exit !== 0) {
		throw new Error(
			`setupPair failed (${setup.exit}): ${setup.stderr}\n${setup.stdout}`,
		);
	}
	return { origin, clone };
}

function plantEmptyHeadTree(clone: string) {
	return `
tree="$(git -C "${clone}" rev-parse 'HEAD^{tree}')"
dir="$(printf '%s' "$tree" | cut -c1-2)"
rest="$(printf '%s' "$tree" | cut -c3-)"
obj="${clone}/.git/objects/$dir/$rest"
mkdir -p "$(dirname "$obj")"
if [[ -e "$obj" ]]; then chmod u+w "$obj"; fi
: > "$obj"
`;
}

beforeAll(async () => {
	gitconfig = join(await tempDir(), "gitconfig");
	await Bun.write(
		gitconfig,
		`[user]
	name = test
	email = test@example.com
[protocol "file"]
	allow = always
[commit]
	gpgsign = false
`,
	);
});

afterAll(async () => {
	await Promise.all(
		dirs.map((dir) => rm(dir, { recursive: true, force: true })),
	);
});

describe("managed git corruption guard", () => {
	test("detects an empty object file", async () => {
		const { clone } = await setupPair();
		const result = await bash(`
${plantEmptyHeadTree(clone)}
source "${libSh}"
if git_checkout_corrupt "${clone}"; then echo CORRUPT; else echo CLEAN; fi
`);
		expect(result.exit).toBe(0);
		expect(result.stdout.trim()).toBe("CORRUPT");
	});

	test("sync prunes empty objects and fast-forwards", async () => {
		const { origin, clone } = await setupPair();
		const result = await bash(`
echo two > "${origin}/file"
git -C "${origin}" add file
git -C "${origin}" commit --no-gpg-sign -m two
${plantEmptyHeadTree(clone)}
source "${libSh}"
sync_managed_checkout "${clone}" main
git -C "${clone}" log -1 --format=%s
if git_checkout_corrupt "${clone}"; then echo STILL_CORRUPT; else echo CLEAN; fi
`);
		expect(result.exit).toBe(0);
		expect(result.stderr).toContain("git corruption detected, repairing");
		expect(result.stdout).toContain("two");
		expect(result.stdout).toContain("CLEAN");
	});

	test("git_in allows a checkout git refuses without safe.directory", async () => {
		const { clone } = await setupPair();
		const result = await bash(`
source "${libSh}"
git_in "${clone}" rev-parse --is-inside-work-tree
`);
		expect(result.exit).toBe(0);
		expect(result.stdout.trim()).toBe("true");
	});

	test("reclone restores a wrecked object store", async () => {
		const { origin, clone } = await setupPair();
		const result = await bash(`
echo two > "${origin}/file"
git -C "${origin}" add file
git -C "${origin}" commit --no-gpg-sign -m two
rm -rf "${clone}/.git/objects"
source "${libSh}"
reclone_managed_checkout "${clone}" main
printf 'MSG:%s\n' "$(git -C "${clone}" log -1 --format=%s)"
if git_checkout_corrupt "${clone}"; then echo STILL_CORRUPT; else echo CLEAN; fi
`);
		expect(result.exit).toBe(0);
		expect(result.stdout).toContain("MSG:two");
		expect(result.stdout).toContain("CLEAN");
	});
});
