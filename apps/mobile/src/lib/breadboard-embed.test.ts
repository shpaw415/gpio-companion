import { describe, expect, test } from "bun:test";
import {
	BREADBOARD_EMBED_MESSAGE_TYPE,
	breadboardEmbedScript,
	mobileBreadboardEmbedUrl,
} from "./breadboard-embed.ts";

describe("mobile breadboard embed", () => {
	test("builds the dashboard embed url", () => {
		expect(
			mobileBreadboardEmbedUrl("https://gpio-companion.com", {
				locale: "fr",
				theme: "dark",
			}),
		).toBe("https://gpio-companion.com/embed/breadboard?locale=fr&theme=dark");
	});

	test("injects the gpio-breadboard payload", () => {
		const script = breadboardEmbedScript({
			type: BREADBOARD_EMBED_MESSAGE_TYPE,
			diagramText: '{"version":1}',
		});
		expect(script).toContain("window.__gpioBreadboardEmbed");
		expect(script).toContain(BREADBOARD_EMBED_MESSAGE_TYPE);
		expect(script.endsWith("true;")).toBe(true);
	});
});
