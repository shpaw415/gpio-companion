export type AuthRefreshClient = {
	getToken(): string | null;
	setTokenToCookie(): void;
	triggerRefresh(): Promise<boolean>;
};

const RETRY_HEADER = "x-gpio-auth-retry";

export function isLoginRequiredError(message: string): boolean {
	const normalized = message.trim().toLowerCase();
	return (
		normalized === "sign in first" ||
		normalized === "login first" ||
		normalized.startsWith("sign in first") ||
		normalized.startsWith("login first")
	);
}

export function loginRequiredFromActionBody(text: string): boolean {
	if (!text.trim()) {
		return false;
	}
	try {
		const error = actionErrorFromBody(JSON.parse(text) as unknown);
		return Boolean(error && isLoginRequiredError(error));
	} catch {
		return isLoginRequiredError(text);
	}
}

export function syncAccessCookie(auth: AuthRefreshClient): void {
	if (!auth.getToken()) {
		return;
	}
	auth.setTokenToCookie();
}

const cookieSynced = new WeakSet<object>();

export function attachAccessCookieSync(auth: AuthRefreshClient): void {
	if (cookieSynced.has(auth)) {
		return;
	}
	cookieSynced.add(auth);
	const original = auth.triggerRefresh.bind(auth);
	auth.triggerRefresh = async () => {
		const ok = await original();
		if (ok) {
			syncAccessCookie(auth);
		}
		return ok;
	};
}

export function createAuthAwareFetch(
	baseFetch: typeof fetch,
	auth: AuthRefreshClient,
	origin = typeof window === "undefined" ? "" : window.location.origin,
): typeof fetch {
	let refreshPromise: Promise<boolean> | null = null;

	async function refreshOnce(): Promise<boolean> {
		if (refreshPromise) {
			return refreshPromise;
		}
		refreshPromise = (async () => {
			const ok = await auth.triggerRefresh();
			if (ok) {
				syncAccessCookie(auth);
			}
			return ok;
		})().finally(() => {
			refreshPromise = null;
		});
		return refreshPromise;
	}

	return async (input, init) => {
		const request = new Request(input, init);
		if (
			!shouldIntercept(request, origin) ||
			request.headers.get(RETRY_HEADER)
		) {
			return baseFetch(request);
		}
		const retryable = request.clone();
		const response = await baseFetch(request);
		if (!(await responseNeedsRefresh(response))) {
			return response;
		}
		if (!(await refreshOnce())) {
			return response;
		}
		const headers = new Headers(retryable.headers);
		headers.set(RETRY_HEADER, "1");
		return baseFetch(new Request(retryable, { headers }));
	};
}

export function installAuthAwareFetch(auth: AuthRefreshClient): () => void {
	if (typeof window === "undefined") {
		return () => undefined;
	}
	const original = window.fetch.bind(window);
	window.fetch = createAuthAwareFetch(original, auth);
	return () => {
		window.fetch = original;
	};
}

function shouldIntercept(request: Request, origin: string): boolean {
	if (request.headers.get("x-server-action") === "true") {
		return true;
	}
	try {
		const url = new URL(request.url, origin || undefined);
		if (origin && url.origin !== origin) {
			return false;
		}
		return url.pathname.startsWith("/api/");
	} catch {
		return false;
	}
}

async function responseNeedsRefresh(response: Response): Promise<boolean> {
	if (response.status === 401) {
		return true;
	}
	try {
		return loginRequiredFromActionBody(await response.clone().text());
	} catch {
		return false;
	}
}

function actionErrorFromBody(value: unknown, depth = 0): string | null {
	if (depth > 4 || !value || typeof value !== "object") {
		return null;
	}
	const rec = value as Record<string, unknown>;
	if (rec.ok === false && typeof rec.error === "string") {
		return rec.error;
	}
	if ("json" in rec) {
		return actionErrorFromBody(rec.json, depth + 1);
	}
	if ("props" in rec) {
		return actionErrorFromBody(rec.props, depth + 1);
	}
	return null;
}
