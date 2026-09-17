import {
	AGENT_PATH,
	AGENT_STOP_PATH,
	ARDUINO_PROXY_PATH,
	DEFAULT_DEVICE_KEY_ID,
	FLASH_PATH,
	FLASH_PROXY_PATH,
	FLASH_SKETCHES_PATH,
	GPIO_PATH,
	PROJECTS_PUSH_PATH,
	RUN_PATH,
	RUN_SKETCHES_PATH,
	RUN_STOP_PATH,
	signDeviceRequest,
	VERIFY_PATH,
} from "gpio-companion";

export type VoiceToolContext = {
	deviceUrl: string;
	privateKeyPem: string;
	keyId?: string;
	repo: string;
	owner: string;
};

export async function runVoiceTool(
	name: string,
	args: Record<string, unknown>,
	ctx: VoiceToolContext,
): Promise<unknown> {
	switch (name) {
		case "gpio_snapshot":
			return signedJson(ctx, "GET", GPIO_PATH);
		case "arduino_proxy_status":
			return signedJson(ctx, "GET", ARDUINO_PROXY_PATH);
		case "list_sketches": {
			const host = await signedJson(ctx, "GET", RUN_SKETCHES_PATH);
			const firmware = await signedJson(ctx, "GET", FLASH_SKETCHES_PATH);
			return { host, firmware };
		}
		case "run_sketch":
			return signedJson(ctx, "POST", RUN_PATH, { dir: asString(args.dir) });
		case "stop_sketch":
			return signedJson(ctx, "POST", RUN_STOP_PATH);
		case "verify_circuit":
			return signedJson(ctx, "POST", VERIFY_PATH, { repo: requiredRepo(ctx) });
		case "flash_proxy":
			return signedJson(ctx, "POST", FLASH_PROXY_PATH, {});
		case "flash_arduino":
			return signedJson(ctx, "POST", FLASH_PATH, {
				dir: asString(args.dir),
				fqbn: typeof args.fqbn === "string" ? args.fqbn : "arduino:avr:uno",
			});
		case "save_project":
			if (!ctx.owner || !ctx.repo) {
				throw new Error("open a project first");
			}
			return signedJson(ctx, "POST", PROJECTS_PUSH_PATH, {
				owner: ctx.owner,
				name: ctx.repo,
			});
		case "ask_companion":
			return signedJson(ctx, "POST", AGENT_PATH, {
				repo: requiredRepo(ctx),
				prompt: asString(args.prompt),
			});
		case "agent_status":
			return signedJson(ctx, "GET", AGENT_PATH);
		case "stop_agent":
			return signedJson(ctx, "POST", AGENT_STOP_PATH);
		default:
			throw new Error(`unknown tool ${name}`);
	}
}

async function signedJson(
	ctx: VoiceToolContext,
	method: string,
	path: string,
	body?: unknown,
): Promise<unknown> {
	const origin = ctx.deviceUrl.replace(/\/+$/, "");
	const bodyText = body === undefined ? "" : JSON.stringify(body);
	const headers = await signDeviceRequest({
		privateKeyPem: ctx.privateKeyPem,
		keyId: ctx.keyId ?? DEFAULT_DEVICE_KEY_ID,
		method,
		path,
		body: bodyText,
	});
	const response = await fetch(`${origin}${path}`, {
		method,
		headers: {
			"content-type": "application/json",
			...headers,
		},
		body: bodyText || undefined,
	});
	const text = await response.text();
	let parsed: unknown = text;
	try {
		parsed = text ? JSON.parse(text) : null;
	} catch {
		parsed = { text };
	}
	if (!response.ok) {
		const error =
			parsed &&
			typeof parsed === "object" &&
			"error" in parsed &&
			typeof (parsed as { error: unknown }).error === "string"
				? (parsed as { error: string }).error
				: `device ${response.status}`;
		throw new Error(error);
	}
	return parsed;
}

function asString(value: unknown): string {
	if (typeof value !== "string" || !value.trim()) {
		throw new Error("required string");
	}
	return value.trim();
}

function requiredRepo(ctx: VoiceToolContext): string {
	if (!ctx.repo) {
		throw new Error("open a project first");
	}
	return ctx.repo;
}
