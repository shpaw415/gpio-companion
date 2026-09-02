import { describe, expect, test } from "bun:test";
import {
	type AuthRefreshClient,
	createAuthAwareFetch,
	isLoginRequiredError,
	loginRequiredFromActionBody,
	syncAccessCookie,
} from "./refresh.ts";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function mockAuth(options: {
	token?: string | null;
	refresh?: boolean;
	onRefresh?: () => void;
}): AuthRefreshClient & { cookie: string | null; refreshes: number } {
	const state = {
		token: options.token === undefined ? "access" : options.token,
		cookie: null as string | null,
		refreshes: 0,
	};
	return {
		get cookie() {
			return state.cookie;
		},
		get refreshes() {
			return state.refreshes;
		},
		getToken() {
			return state.token;
		},
		setTokenToCookie() {
			state.cookie = state.token;
		},
		async triggerRefresh() {
			state.refreshes += 1;
			options.onRefresh?.();
			if (!options.refresh) {
				return false;
			}
			state.token = "refreshed";
			return true;
		},
	};
}

describe("isLoginRequiredError", () => {
	test("matches sign in first and login first", () => {
		expect(isLoginRequiredError("sign in first")).toBe(true);
		expect(isLoginRequiredError("login first")).toBe(true);
		expect(isLoginRequiredError(" Login first ")).toBe(true);
		expect(isLoginRequiredError("admin only")).toBe(false);
		expect(isLoginRequiredError("uuid is required")).toBe(false);
	});
});

describe("loginRequiredFromActionBody", () => {
	test("reads wrapAction and superjson envelopes", () => {
		expect(
			loginRequiredFromActionBody(
				JSON.stringify({ ok: false, error: "sign in first" }),
			),
		).toBe(true);
		expect(
			loginRequiredFromActionBody(
				JSON.stringify({ json: { ok: false, error: "login first" } }),
			),
		).toBe(true);
		expect(
			loginRequiredFromActionBody(
				JSON.stringify({ ok: false, error: "uuid is required" }),
			),
		).toBe(false);
	});
});

describe("createAuthAwareFetch", () => {
	test("retries once after login first then succeeds", async () => {
		const auth = mockAuth({ refresh: true });
		let calls = 0;
		const aware = createAuthAwareFetch(
			async () => {
				calls += 1;
				if (calls === 1) {
					return jsonResponse({ ok: false, error: "login first" });
				}
				return jsonResponse({ ok: true, data: { id: "u1" } });
			},
			auth,
			"https://gpio-companion.com",
		);
		const response = await aware("https://gpio-companion.com/api/pair", {
			headers: { "x-server-action": "true" },
		});
		expect(calls).toBe(2);
		expect(auth.refreshes).toBe(1);
		expect(auth.cookie).toBe("refreshed");
		expect(await response.json()).toEqual({ ok: true, data: { id: "u1" } });
	});

	test("does not refresh twice when retry still returns login first", async () => {
		const auth = mockAuth({ refresh: true });
		let calls = 0;
		const aware = createAuthAwareFetch(
			async () => {
				calls += 1;
				return jsonResponse({ ok: false, error: "login first" });
			},
			auth,
			"https://gpio-companion.com",
		);
		const response = await aware("https://gpio-companion.com/api/pair", {
			headers: { "x-server-action": "true" },
		});
		expect(calls).toBe(2);
		expect(auth.refreshes).toBe(1);
		expect(await response.json()).toEqual({
			ok: false,
			error: "login first",
		});
	});

	test("does not retry when refresh fails", async () => {
		const auth = mockAuth({ refresh: false });
		let calls = 0;
		const aware = createAuthAwareFetch(
			async () => {
				calls += 1;
				return jsonResponse({ ok: false, error: "sign in first" });
			},
			auth,
			"https://gpio-companion.com",
		);
		const response = await aware("https://gpio-companion.com/api/pair", {
			headers: { "x-server-action": "true" },
		});
		expect(calls).toBe(1);
		expect(auth.refreshes).toBe(1);
		expect(await response.json()).toEqual({
			ok: false,
			error: "sign in first",
		});
	});

	test("single-flights parallel 401s", async () => {
		const auth = mockAuth({ refresh: true });
		let calls = 0;
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const aware = createAuthAwareFetch(
			async () => {
				calls += 1;
				if (calls <= 2) {
					return jsonResponse({ ok: false, error: "sign in first" }, 401);
				}
				return jsonResponse({ ok: true, data: true });
			},
			{
				...auth,
				async triggerRefresh() {
					await gate;
					return auth.triggerRefresh();
				},
			},
			"https://gpio-companion.com",
		);
		const pending = Promise.all([
			aware("https://gpio-companion.com/api/pair", {
				headers: { "x-server-action": "true" },
			}),
			aware("https://gpio-companion.com/api/device", {
				headers: { "x-server-action": "true" },
			}),
		]);
		release();
		await pending;
		expect(auth.refreshes).toBe(1);
		expect(calls).toBe(4);
	});

	test("skips non-action requests", async () => {
		const auth = mockAuth({ refresh: true });
		let calls = 0;
		const aware = createAuthAwareFetch(
			async () => {
				calls += 1;
				return jsonResponse({ ok: false, error: "login first" });
			},
			auth,
			"https://gpio-companion.com",
		);
		await aware("https://auth.example.com/session/public");
		expect(calls).toBe(1);
		expect(auth.refreshes).toBe(0);
	});
});

describe("syncAccessCookie", () => {
	test("writes cookie when a token exists", () => {
		const auth = mockAuth({ token: "abc" });
		syncAccessCookie(auth);
		expect(auth.cookie).toBe("abc");
	});

	test("skips when token is missing", () => {
		const auth = mockAuth({ token: null });
		syncAccessCookie(auth);
		expect(auth.cookie).toBe(null);
	});
});
