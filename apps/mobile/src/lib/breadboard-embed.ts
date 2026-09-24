import {
	BREADBOARD_EMBED_MESSAGE_TYPE,
	BREADBOARD_EMBED_READY_TYPE,
	type BreadboardEmbedPayload,
	breadboardEmbedInjectSource,
	breadboardEmbedUrl,
} from "gpio-companion-embed";

export {
	BREADBOARD_EMBED_MESSAGE_TYPE,
	BREADBOARD_EMBED_READY_TYPE,
	type BreadboardEmbedPayload,
	breadboardEmbedUrl,
};

export function mobileBreadboardEmbedUrl(
	origin: string,
	opts?: { locale?: string; theme?: string },
): string {
	return breadboardEmbedUrl(origin, opts);
}

export function breadboardEmbedScript(payload: BreadboardEmbedPayload): string {
	return breadboardEmbedInjectSource(payload);
}
