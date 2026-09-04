"no action";

import { openaiChatModelList } from "gpio-companion";
import {
	bearerToken,
	userIdForAiAuth,
} from "../../../../lib/ai-credentials.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
};

const CORS = {
	"access-control-allow-origin": "*",
	"access-control-allow-headers": "authorization,content-type",
	"access-control-allow-methods": "GET,OPTIONS",
};

export async function onRequestOptions() {
	return new Response(null, {
		status: 204,
		headers: CORS,
	});
}

export async function onRequestGet(ctx: { request: Request; env: PagesEnv }) {
	const key = bearerToken(ctx.request);
	if (!key) {
		return error(401, "missing api key");
	}
	const userId = await userIdForAiAuth(ctx.env, key);
	if (!userId) {
		return error(401, "unknown api key");
	}
	return Response.json(
		{
			object: "list",
			data: openaiChatModelList(),
		},
		{ headers: CORS },
	);
}

function error(status: number, message: string): Response {
	return Response.json(
		{
			error: {
				message,
				type: "invalid_request_error",
			},
		},
		{ status, headers: CORS },
	);
}
