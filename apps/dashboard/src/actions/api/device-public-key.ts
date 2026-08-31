"no action";

import {
	DEFAULT_DEVICE_KEY_ID,
	publicKeyPemFromPrivateKey,
} from "gpio-companion";

type PagesEnv = {
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

export async function onRequestGet(ctx: { env: PagesEnv }) {
	const privateKeyPem = ctx.env.GPIO_COMPANION_DEVICE_PRIVATE_KEY ?? "";
	if (!privateKeyPem.trim()) {
		return Response.json(
			{ error: "device signing key is not configured" },
			{ status: 503 },
		);
	}
	try {
		const publicKeyPem = await publicKeyPemFromPrivateKey(privateKeyPem);
		return Response.json(
			{
				keyId: ctx.env.GPIO_COMPANION_DEVICE_KEY_ID ?? DEFAULT_DEVICE_KEY_ID,
				publicKeyPem,
			},
			{
				headers: {
					"cache-control": "public, max-age=60",
				},
			},
		);
	} catch {
		return Response.json(
			{ error: "device signing key is invalid" },
			{ status: 503 },
		);
	}
}
