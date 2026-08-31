"no action";

import {
	consumeCredit,
	creditsBalance,
	userIdForAiKey,
} from "../../../../../lib/credits.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	AI?: Ai;
};

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

function bearer(request: Request): string {
	const header = request.headers.get("authorization") ?? "";
	const match = header.match(/^Bearer\s+(\S+)/i);
	return match?.[1]?.trim() ?? "";
}

export async function onRequestOptions() {
	return new Response(null, {
		status: 204,
		headers: {
			"access-control-allow-origin": "*",
			"access-control-allow-headers": "authorization,content-type",
			"access-control-allow-methods": "POST,OPTIONS",
		},
	});
}

export async function onRequestPost(ctx: { request: Request; env: PagesEnv }) {
	const key = bearer(ctx.request);
	if (!key) {
		return error(401, "missing api key");
	}
	const userId = await userIdForAiKey(ctx.env.DYNAMIC_PAGE_KV, key);
	if (!userId) {
		return error(401, "unknown api key");
	}
	const balance = await creditsBalance(ctx.env.DYNAMIC_PAGE_KV, userId);
	if (balance <= 0) {
		return error(402, "credits empty");
	}
	if (!ctx.env.AI) {
		return error(503, "workers ai is not bound");
	}
	let body: {
		model?: string;
		messages?: Array<{ role: string; content: unknown }>;
	};
	try {
		body = (await ctx.request.json()) as typeof body;
	} catch {
		return error(400, "invalid json");
	}
	const model = body.model?.trim() || DEFAULT_MODEL;
	const messages = (body.messages ?? []).map((message) => ({
		role: message.role,
		content: typeof message.content === "string" ? message.content : "",
	}));
	try {
		const result = await ctx.env.AI.run(model as keyof AiModels, {
			messages,
		});
		await consumeCredit(ctx.env.DYNAMIC_PAGE_KV, userId);
		const text = assistantText(result);
		return Response.json({
			id: `gpio-${crypto.randomUUID()}`,
			object: "chat.completion",
			created: Math.floor(Date.now() / 1000),
			model,
			choices: [
				{
					index: 0,
					message: { role: "assistant", content: text },
					finish_reason: "stop",
				},
			],
			usage: {
				prompt_tokens: 0,
				completion_tokens: 0,
				total_tokens: 0,
			},
		});
	} catch (caught) {
		const message =
			caught instanceof Error ? caught.message : "workers ai failed";
		return error(502, message);
	}
}

function assistantText(result: unknown): string {
	if (typeof result === "string") {
		return result;
	}
	if (result && typeof result === "object" && "response" in result) {
		return String((result as { response: unknown }).response ?? "");
	}
	return JSON.stringify(result ?? "");
}

function error(status: number, message: string): Response {
	return Response.json(
		{
			error: {
				message,
				type: status === 402 ? "insufficient_quota" : "invalid_request_error",
			},
		},
		{ status },
	);
}
