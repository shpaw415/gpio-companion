export const ACCESS_TOKEN_COOKIE = "access_token";

export function syncAccessTokenCookie(token: string | null | undefined): void {
	if (typeof document === "undefined") {
		return;
	}
	if (!token) {
		document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
		return;
	}
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	document.cookie = `${ACCESS_TOKEN_COOKIE}=${token}; path=/; SameSite=Lax${secure}`;
}
