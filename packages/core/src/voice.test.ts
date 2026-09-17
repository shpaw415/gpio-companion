import { describe, expect, test } from "bun:test";
import { generateDeviceKeyPair } from "./device-auth.ts";
import {
	encodeVoiceMessage,
	matchesWakePhrase,
	parseVoiceClientMessage,
	parseVoiceId,
	parseVoiceMicMode,
	signVoiceTicket,
	VOICE_PATH,
	VOICE_S2S_USD_PER_MIN,
	VOICE_TOKEN_PREFIX,
	verifyVoiceTicket,
	voiceSessionMicros,
	voiceWsUrl,
} from "./voice.ts";

describe("voice protocol", () => {
	test("parses client messages", () => {
		expect(
			parseVoiceClientMessage({
				v: 1,
				type: "start",
				repo: "blink-led",
				mode: "wake",
			}),
		).toEqual({
			v: 1,
			type: "start",
			mode: "wake",
			repo: "blink-led",
		});
		expect(parseVoiceClientMessage({ v: 1, type: "secret" })).toBeNull();
		expect(parseVoiceMicMode("always")).toBe("always");
		expect(parseVoiceMicMode("nope")).toBe("hold");
		expect(parseVoiceId("rex")).toBe("rex");
		expect(parseVoiceId("nope")).toBe("eve");
		expect(
			parseVoiceClientMessage({
				v: 1,
				type: "hello",
				voice: "Ara",
			})?.voice,
		).toBe("ara");
	});

	test("encodes a server status", () => {
		expect(
			JSON.parse(
				encodeVoiceMessage({
					v: 1,
					type: "status",
					state: "talking",
					billed: true,
				}),
			),
		).toEqual({
			v: 1,
			type: "status",
			state: "talking",
			billed: true,
		});
	});

	test("matches the wake phrase", () => {
		expect(matchesWakePhrase("Hey Companion, blink pin 7")).toBe(true);
		expect(matchesWakePhrase("dis companion")).toBe(true);
		expect(matchesWakePhrase("hé compagnon")).toBe(true);
		expect(matchesWakePhrase("ok companion please")).toBe(true);
		expect(matchesWakePhrase("hello board")).toBe(false);
	});

	test("bills speech-to-speech minutes", () => {
		expect(voiceSessionMicros(60_000, 1)).toBe(
			Math.round(VOICE_S2S_USD_PER_MIN * 1_000_000),
		);
		expect(voiceSessionMicros(0)).toBe(0);
	});

	test("mints and verifies a voice ticket", async () => {
		const keys = await generateDeviceKeyPair();
		const ticket = await signVoiceTicket({
			privateKeyPem: keys.privateKeyPem,
			uuid: "pair-uuid",
			userId: "user-1",
			origin: "https://gpio-companion.com",
		});
		expect(ticket.token.startsWith(VOICE_TOKEN_PREFIX)).toBe(true);
		expect(ticket.wsUrl).toBe(
			`wss://gpio-companion.com${VOICE_PATH}?uuid=pair-uuid&ticket=${ticket.token}`,
		);
		expect(voiceWsUrl("https://gpio-companion.com/", "abc")).toBe(
			`wss://gpio-companion.com${VOICE_PATH}?uuid=abc`,
		);
		const claims = await verifyVoiceTicket({
			token: ticket.token,
			privateKeyPem: keys.privateKeyPem,
		});
		expect(claims.uuid).toBe("pair-uuid");
		expect(claims.userId).toBe("user-1");
	});
});
