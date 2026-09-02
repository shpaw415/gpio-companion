import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const libSh = join(import.meta.dir, "lib.sh");
const ident =
	"GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1";

const dirs: string[] = [];

async function tempDir() {
	const dir = await mkdtemp(join(tmpdir(), "gpio-git-"));
	dirs.push(dir);
	return dir;
}

async function bash(script: string) {
	const proc = Bun.spawn(["bash", "-ec", script], {
		stdout: "pipe",
		stderr: "pipe",
		env: { ...process.env },
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
${ident}
git init -b main "${origin}"
echo one > "${origin}/file"
git -C "${origin}" add file
git -C "${origin}" commit -m one
git clone --depth 1 "file://${origin}" "${clone}"
`);
	expect(setup.exit).toBe(0);
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

afterAll(async () => {
	await Promise.all(
		dirs.map((dir) => rm(dir, { recursive: true, force: true })),
	);
});

describe("managed git corruption guard", () => {
	test("detects an empty object file", async () => {
		const { clone } = await setupPair();
		const result = await bash(`
${ident}
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
${ident}
echo two > "${origin}/file"
git -C "${origin}" add file
git -C "${origin}" commit -m two
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

	test("reclone restores a wrecked object store", async () => {
		const { origin, clone } = await setupPair();
		const result = await bash(`
${ident}
echo two > "${origin}/file"
git -C "${origin}" add file
git -C "${origin}" commit -m two
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
