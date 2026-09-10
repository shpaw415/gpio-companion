import { afterEach, describe, expect, test } from "bun:test";
import { createGpioCompanionRepo, parseRepoName } from "./github.ts";

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

	test("app tokens create user repos with GraphQL, not POST /user/repos", async () => {
		const paths: string[] = [];
		globalThis.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			const url = String(input);
			const path = url.replace("https://api.github.com", "");
			paths.push(`${init?.method ?? "GET"} ${path}`);
			if (path === "/users/ada") {
				return json({ login: "ada", type: "User", node_id: "U_ada" });
			}
			if (path === "/graphql") {
				return json({
					data: {
						createRepository: {
							repository: {
								name: "blink",
								nameWithOwner: "ada/blink",
								url: "https://github.com/ada/blink",
								owner: { login: "ada" },
							},
						},
					},
				});
			}
			if (path === "/repos/ada/blink/contents/.gpio-companion") {
				return json({}, 201);
			}
			return json({ message: `unexpected ${path}` }, 500);
		}) as typeof fetch;
		const repo = await createGpioCompanionRepo(
			{ username: "ada", token: "ghs_install" },
			"blink",
		);
		expect(repo).toEqual({
			full_name: "ada/blink",
			name: "blink",
			owner: "ada",
			html_url: "https://github.com/ada/blink",
		});
		expect(paths.some((item) => item.includes("/user/repos"))).toBe(false);
		expect(paths).toContain("POST /graphql");
	});

	test("app tokens create org repos with POST /orgs/{org}/repos", async () => {
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
		expect(paths.some((item) => item.includes("/user/repos"))).toBe(false);
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
