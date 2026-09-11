export function parseGithubAppCallbackFromUrl(raw: string): {
	code: string;
	state: string;
	installationId: string;
	redirectUri: string;
} | null {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return null;
	}
	const code = url.searchParams.get("code") ?? "";
	const state = url.searchParams.get("state") ?? "";
	const installationId = url.searchParams.get("installation_id") ?? "";
	const iss = url.searchParams.get("iss") ?? "";
	const githubPath =
		url.pathname === "/profile/github" || url.pathname === "/devices/keys";
	const githubIss = iss.includes("github.com/login/oauth");
	if (!(githubPath || githubIss) || !(code || installationId) || !state) {
		return null;
	}
	const redirectUri =
		url.protocol === "http:" || url.protocol === "https:"
			? `${url.origin}${url.pathname}`
			: raw.replace(/[?#].*$/, "");
	return { code, state, installationId, redirectUri };
}
