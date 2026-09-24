interface Env {
	PUBLIC_PAYPAL_CLIENT_ID?: string;
	PAYPAL_CLIENT_SECRET?: string;
	PAYPAL_ENV?: string;
	MARKETPLACE_ADMIN_TOKEN?: string;
	AUTH_SECRET?: string;
	PUBLIC_AUTH_ISSUER?: string;
	PUBLIC_AUTH_CLIENT_ID?: string;
	PUBLIC_AUTH_REDIRECT_URI?: string;
}

declare module "@cf-process-env.json" {
    const env: Record<string, string>;
    export default env;
}