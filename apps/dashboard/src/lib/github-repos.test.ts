import { afterEach, describe, expect, test } from "bun:test";
import {
	createGpioCompanionRepo,
	indexProject,
	listRepos,
	loadIndexedProjects,
	parseRepoName,
} from "./github.ts";

describe("parseRepoName", () => {
	test("accepts github names", () => {
		expect(parseRepoName("blink-led")).toBe("blink-led");
		expect(parseRepoName(" Blink.git ")).toBe("Blink");
	});

	test("rejects junk", () => {
		expect(() => parseRepoName("has space")).toThrow();
		expect(() => parseRepoName("../etc")).toThrow();
		expect(() => parseRepoName("")).toThrow();
	});
});

describe("createGpioCompanionRepo", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	function json(body: unknown, status = 200) {
		return new Response(JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json" },
		});
	}

	test("user access tokens POST /user/repos", async () => {
		const paths: string[] = [];
		globalThis.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			const url = String(input);
			const path = url.replace("https://api.github.com", "");
			paths.push(`${init?.method ?? "GET"} ${path}`);
			if (path === "/user/repos") {
				return json(
					{
						id: 77,
						full_name: "ada/blink",
						name: "blink",
						owner: { login: "ada" },
						html_url: "https://github.com/ada/blink",
					},
					201,
				);
			}
			if (path === "/user/installations/9/repositories/77") {
				return new Response(null, { status: 204 });
			}
			if (path === "/repos/ada/blink/contents/.gpio-companion") {
				return json({}, 201);
			}
			return json({ message: `unexpected ${path}` }, 500);
		}) as typeof fetch;
		const repo = await createGpioCompanionRepo(
			{
				username: "ada",
				token: "ghs_install",
				createToken: "ghu_user",
				installationId: 9,
			},
			"blink",
		);
		expect(repo.full_name).toBe("ada/blink");
		expect(paths).toContain("POST /user/repos");
		expect(paths).toContain("PUT /user/installations/9/repositories/77");
		expect(paths.some((item) => item.includes("/graphql"))).toBe(false);
	});

	test("installation tokens create org repos with POST /orgs/{org}/repos", async () => {
		const paths: string[] = [];
		globalThis.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			const url = String(input);
			const path = url.replace("https://api.github.com", "");
			paths.push(`${init?.method ?? "GET"} ${path}`);
			if (path === "/users/acme") {
				return json({ login: "acme", type: "Organization", node_id: "O_acme" });
			}
			if (path === "/orgs/acme/repos") {
				return json(
					{
						full_name: "acme/blink",
						name: "blink",
						owner: { login: "acme" },
						html_url: "https://github.com/acme/blink",
					},
					201,
				);
			}
			if (path === "/repos/acme/blink/contents/.gpio-companion") {
				return json({}, 201);
			}
			return json({ message: `unexpected ${path}` }, 500);
		}) as typeof fetch;
		const repo = await createGpioCompanionRepo(
			{ username: "acme", token: "ghs_install" },
			"blink",
		);
		expect(repo.full_name).toBe("acme/blink");
		expect(paths).toContain("POST /orgs/acme/repos");
	});

	test("installation tokens cannot create user repos without a user token", async () => {
		globalThis.fetch = (async (
			input: RequestInfo | URL,
			_init?: RequestInit,
		) => {
			const path = String(input).replace("https://api.github.com", "");
			if (path === "/users/ada") {
				return json({ login: "ada", type: "User", node_id: "U_ada" });
			}
			return json({ message: `unexpected ${path}` }, 500);
		}) as typeof fetch;
		await expect(
			createGpioCompanionRepo(
				{ username: "ada", token: "ghs_install" },
				"blink",
			),
		).rejects.toThrow("Reconnect GitHub on Profile");
	});

	test("classic tokens still POST /user/repos", async () => {
		const paths: string[] = [];
		globalThis.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			const url = String(input);
			const path = url.replace("https://api.github.com", "");
			paths.push(`${init?.method ?? "GET"} ${path}`);
			if (path === "/user/repos") {
				return json(
					{
						full_name: "ada/blink",
						name: "blink",
						owner: { login: "ada" },
						html_url: "https://github.com/ada/blink",
					},
					201,
				);
			}
			if (path === "/repos/ada/blink/contents/.gpio-companion") {
				return json({}, 201);
			}
			return json({ message: `unexpected ${path}` }, 500);
		}) as typeof fetch;
		await createGpioCompanionRepo(
			{ username: "ada", token: "ghp_pat" },
			"blink",
		);
		expect(paths).toContain("POST /user/repos");
	});
});

describe("listRepos", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	function json(body: unknown, status = 200, link?: string) {
		const headers = new Headers({ "content-type": "application/json" });
		if (link) {
			headers.set("link", link);
		}
		return new Response(JSON.stringify(body), { status, headers });
	}

	function repo(login: string, name: string, description?: string) {
		return {
			full_name: `${login}/${name}`,
			name,
			owner: { login },
			html_url: `https://github.com/${login}/${name}`,
			description: description ?? null,
		};
	}

	test("keeps installation repos that have the watermark", async () => {
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const path = String(input).replace("https://api.github.com", "");
			if (path.startsWith("/installation/repositories")) {
				return json({ repositories: [repo("ada", "blink")] });
			}
			if (path === "/repos/ada/blink/contents/.gpio-companion") {
				return json({}, 200);
			}
			if (path.startsWith("/search/")) {
				return json({ items: [] });
			}
			return json({ message: `unexpected ${path}` }, 500);
		}) as typeof fetch;
		const repos = await listRepos({ username: "ada", token: "ghs_install" });
		expect(repos.map((item) => item.full_name)).toEqual(["ada/blink"]);
	});

	test("fetches owned watermarked repos with the user token when the installation list is empty", async () => {
		const paths: string[] = [];
		globalThis.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			const url = String(input);
			const path = url.replace("https://api.github.com", "");
			const auth = String(
				new Headers(init?.headers).get("authorization") ?? "",
			);
			paths.push(`${auth} ${path}`);
			if (path.startsWith("/installation/repositories")) {
				return json({ repositories: [] });
			}
			if (path.startsWith("/user/repos")) {
				expect(auth).toContain("ghu_user");
				return json([repo("ada", "blink", "gpio-companion project")]);
			}
			if (path === "/repos/ada/blink/contents/.gpio-companion") {
				expect(auth).toContain("ghu_user");
				return json({}, 200);
			}
			if (path.startsWith("/search/")) {
				return json({ items: [] });
			}
			return json({ message: `unexpected ${path}` }, 500);
		}) as typeof fetch;
		const repos = await listRepos({
			username: "ada",
			token: "ghs_install",
			createToken: "ghu_user",
		});
		expect(repos.map((item) => item.full_name)).toEqual(["ada/blink"]);
		expect(paths.some((item) => item.includes("/user/repos"))).toBe(true);
	});

	test("includes indexed repos after refresh", async () => {
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const path = String(input).replace("https://api.github.com", "");
			if (path.startsWith("/installation/repositories")) {
				return json({ repositories: [] });
			}
			if (path.startsWith("/user/repos")) {
				return json([]);
			}
			if (path === "/repos/ada/blink/contents/.gpio-companion") {
				return json({}, 200);
			}
			if (path.startsWith("/search/")) {
				return json({ items: [] });
			}
			return json({ message: `unexpected ${path}` }, 500);
		}) as typeof fetch;
		const repos = await listRepos(
			{
				username: "ada",
				token: "ghs_install",
				createToken: "ghu_user",
			},
			[
				{
					full_name: "ada/blink",
					name: "blink",
					owner: "ada",
					html_url: "https://github.com/ada/blink",
				},
			],
		);
		expect(repos.map((item) => item.full_name)).toEqual(["ada/blink"]);
	});

	test("follows installation pagination", async () => {
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input);
			const path = url.replace("https://api.github.com", "");
			if (path === "/installation/repositories?per_page=100") {
				return json(
					{ repositories: [repo("ada", "one")] },
					200,
					'<https://api.github.com/installation/repositories?per_page=100&page=2>; rel="next"',
				);
			}
			if (path === "/installation/repositories?per_page=100&page=2") {
				return json({ repositories: [repo("ada", "two")] });
			}
			if (path.endsWith("/contents/.gpio-companion")) {
				return json({}, 200);
			}
			if (path.startsWith("/search/")) {
				return json({ items: [] });
			}
			return json({ message: `unexpected ${path}` }, 500);
		}) as typeof fetch;
		const repos = await listRepos({ username: "ada", token: "ghs_install" });
		expect(repos.map((item) => item.full_name).sort()).toEqual([
			"ada/one",
			"ada/two",
		]);
	});
});

describe("indexed projects", () => {
	test("stores created repos for later list", async () => {
		const store = new Map<string, string>();
		const kv = {
			get: async (key: string) => store.get(key) ?? null,
			put: async (key: string, value: string) => {
				store.set(key, value);
			},
			delete: async (key: string) => {
				store.delete(key);
			},
		} as unknown as KVNamespace;
		const repo = {
			full_name: "ada/blink",
			name: "blink",
			owner: "ada",
			html_url: "https://github.com/ada/blink",
		};
		await indexProject(kv, "user-1", repo);
		await indexProject(kv, "user-1", repo);
		expect(await loadIndexedProjects(kv, "user-1")).toEqual([repo]);
	});
});
