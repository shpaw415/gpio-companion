import { describe, expect, test } from "bun:test";
import { projectsRoot, syncProjects } from "./projects.ts";

describe("projectsRoot", () => {
	test("uses GPIO_COMPANION_PROJECTS_DIR", () => {
		const previous = process.env.GPIO_COMPANION_PROJECTS_DIR;
		process.env.GPIO_COMPANION_PROJECTS_DIR = "/tmp/gpio-projects";
		expect(projectsRoot("companion")).toBe("/tmp/gpio-projects");
		if (previous === undefined) {
			delete process.env.GPIO_COMPANION_PROJECTS_DIR;
		} else {
			process.env.GPIO_COMPANION_PROJECTS_DIR = previous;
		}
	});

	test("defaults to ~/projects for the gpio user", () => {
		const previous = process.env.GPIO_COMPANION_PROJECTS_DIR;
		delete process.env.GPIO_COMPANION_PROJECTS_DIR;
		expect(projectsRoot("companion")).toBe("/home/companion/projects");
		if (previous === undefined) {
			delete process.env.GPIO_COMPANION_PROJECTS_DIR;
		} else {
			process.env.GPIO_COMPANION_PROJECTS_DIR = previous;
		}
	});
});

describe("syncProjects", () => {
	test("clones watermarked repos and adds them to t3", async () => {
		const cloned: string[] = [];
		const added: string[] = [];
		const existing = new Set<string>();
		const result = await syncProjects(
			{
				destRoot: "/home/companion/projects",
				token: async () => "ghs_token",
				t3Add: async (path, title) => {
					added.push(`${title}:${path}`);
					return "added";
				},
				exists: (path) => existing.has(path),
				mkdirp: () => undefined,
				gitClone: async (url, dest) => {
					cloned.push(`${url} ${dest}`);
					existing.add(dest);
				},
				fetchImpl: githubFetch({
					repos: [
						{ name: "blink", owner: { login: "ada" } },
						{ name: "notes", owner: { login: "ada" } },
					],
					watermarked: ["ada/blink"],
				}),
			},
			{},
		);
		expect(cloned).toEqual([
			"https://github.com/ada/blink.git /home/companion/projects/blink",
		]);
		expect(added).toEqual(["blink:/home/companion/projects/blink"]);
		expect(result).toEqual({
			cloned: ["blink"],
			added: ["blink"],
			skipped: [],
		});
	});

	test("skips clone when the directory exists", async () => {
		const cloned: string[] = [];
		const dest = "/home/companion/projects/blink";
		const result = await syncProjects({
			destRoot: "/home/companion/projects",
			token: async () => "ghs_token",
			t3Add: async () => "exists",
			exists: (path) => path === dest,
			mkdirp: () => undefined,
			gitClone: async (url, destPath) => {
				cloned.push(`${url} ${destPath}`);
			},
			fetchImpl: githubFetch({
				repos: [{ name: "blink", owner: { login: "ada" } }],
				watermarked: ["ada/blink"],
			}),
		});
		expect(cloned).toEqual([]);
		expect(result.skipped).toEqual(["blink"]);
		expect(result.added).toEqual([]);
	});

	test("clones a gpio-companion repo past the first 80 installation repos", async () => {
		const cloned: string[] = [];
		const filler = Array.from({ length: 90 }, (_, index) => ({
			name: `old-${index}`,
			owner: { login: "ada" as const },
		}));
		await syncProjects({
			destRoot: "/home/companion/projects",
			token: async () => "ghs_token",
			t3Add: async () => "added",
			exists: () => false,
			mkdirp: () => undefined,
			gitClone: async (url, dest) => {
				cloned.push(`${url} ${dest}`);
			},
			fetchImpl: githubFetch({
				repos: [
					...filler,
					{
						name: "blink-test",
						owner: { login: "ada" },
						description: "gpio-companion project",
					},
				],
				watermarked: ["ada/blink-test"],
			}),
		});
		expect(cloned).toEqual([
			"https://github.com/ada/blink-test.git /home/companion/projects/blink-test",
		]);
	});

	test("clones a single pushed repo without listing github", async () => {
		const paths: string[] = [];
		const cloned: string[] = [];
		await syncProjects(
			{
				destRoot: "/home/companion/projects",
				token: async () => {
					throw new Error("token unused");
				},
				t3Add: async () => "added",
				exists: () => false,
				mkdirp: () => undefined,
				gitClone: async (url, dest) => {
					cloned.push(`${url} ${dest}`);
				},
				fetchImpl: async (input) => {
					paths.push(String(input));
					return new Response("nope", { status: 500 });
				},
			},
			{ owner: "ada", name: "new-board" },
		);
		expect(paths).toEqual([]);
		expect(cloned).toEqual([
			"https://github.com/ada/new-board.git /home/companion/projects/new-board",
		]);
	});
});

function githubFetch(options: {
	repos: Array<{
		name: string;
		owner: { login: string };
		description?: string;
	}>;
	watermarked: string[];
}) {
	return async (input: string | URL | Request) => {
		const url = String(input);
		if (url.includes("/installation/repositories")) {
			return Response.json({ repositories: options.repos });
		}
		const match = /\/repos\/([^/]+)\/([^/]+)\/contents\//.exec(url);
		if (match) {
			const full = `${match[1]}/${match[2]}`;
			const ok = options.watermarked.includes(full);
			return new Response(ok ? "ok" : "missing", { status: ok ? 200 : 404 });
		}
		return new Response("nope", { status: 404 });
	};
}
