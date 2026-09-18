import {
	BREADBOARD_EMBED_MESSAGE_TYPE,
	type BreadboardEmbedPayload,
	breadboardEmbedUrl,
} from "gpio-companion-embed";

export {
	BREADBOARD_EMBED_MESSAGE_TYPE,
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
	const json = JSON.stringify(payload);
	return `window.__gpioBreadboardEmbed && window.__gpioBreadboardEmbed(${json}); true;`;
}
