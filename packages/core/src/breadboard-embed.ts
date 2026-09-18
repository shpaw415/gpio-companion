export const BREADBOARD_EMBED_MESSAGE_TYPE = "gpio-breadboard";
export const BREADBOARD_EMBED_PATH = "/embed/breadboard";

export type BreadboardEmbedLivePins = Record<number, 0 | 1>;

export type BreadboardEmbedVerifyItem = {
	id: string;
	status: string;
	partIds?: string[];
	connections?: number[];
};

export type BreadboardEmbedPayload = {
	type: typeof BREADBOARD_EMBED_MESSAGE_TYPE;
	diagramText?: string | null;
	previewUrl?: string | null;
	livePins?: BreadboardEmbedLivePins;
	arduinoLivePins?: BreadboardEmbedLivePins;
	verifyResults?: BreadboardEmbedVerifyItem[];
	boardModel?: string | null;
};

export function isEmbedPath(pathname: string): boolean {
	return pathname === "/embed" || pathname.startsWith("/embed/");
}

export function breadboardEmbedUrl(
	origin: string,
	opts?: { locale?: string; theme?: string },
): string {
	const base = origin.replace(/\/+$/, "");
	const url = new URL(`${base}${BREADBOARD_EMBED_PATH}`);
	if (opts?.locale === "en" || opts?.locale === "fr") {
		url.searchParams.set("locale", opts.locale);
	}
	if (opts?.theme === "dark" || opts?.theme === "light") {
		url.searchParams.set("theme", opts.theme);
	}
	return url.toString();
}

export function parseBreadboardEmbedMessage(
	data: unknown,
): BreadboardEmbedPayload | null {
	const record = asRecord(data);
	if (!record || record.type !== BREADBOARD_EMBED_MESSAGE_TYPE) {
		return null;
	}
	return {
		type: BREADBOARD_EMBED_MESSAGE_TYPE,
		diagramText: asOptionalString(record.diagramText),
		previewUrl: asOptionalString(record.previewUrl),
		livePins: asLivePins(record.livePins),
		arduinoLivePins: asLivePins(record.arduinoLivePins),
		verifyResults: asVerifyResults(record.verifyResults),
		boardModel: asOptionalString(record.boardModel),
	};
}

function asRecord(data: unknown): Record<string, unknown> | null {
	if (typeof data === "string") {
		try {
			data = JSON.parse(data);
		} catch {
			return null;
		}
	}
	if (!data || typeof data !== "object" || Array.isArray(data)) {
		return null;
	}
	return data as Record<string, unknown>;
}

function asOptionalString(value: unknown): string | null | undefined {
	if (value == null) {
		return value;
	}
	return typeof value === "string" ? value : undefined;
}

function asLivePins(value: unknown): BreadboardEmbedLivePins | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	const pins: BreadboardEmbedLivePins = {};
	for (const [key, pin] of Object.entries(value)) {
		const physical = Number(key);
		if (!Number.isInteger(physical)) {
			continue;
		}
		if (pin === 0 || pin === 1) {
			pins[physical] = pin;
		}
	}
	return pins;
}

function asVerifyResults(
	value: unknown,
): BreadboardEmbedVerifyItem[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}
	const items: BreadboardEmbedVerifyItem[] = [];
	for (const entry of value) {
		if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
			continue;
		}
		const record = entry as Record<string, unknown>;
		if (typeof record.id !== "string" || typeof record.status !== "string") {
			continue;
		}
		items.push({
			id: record.id,
			status: record.status,
			partIds: asStringArray(record.partIds),
			connections: asNumberArray(record.connections),
		});
	}
	return items;
}

function asStringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}
	return value.filter((item): item is string => typeof item === "string");
}

function asNumberArray(value: unknown): number[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}
	return value.filter((item): item is number => typeof item === "number");
}
