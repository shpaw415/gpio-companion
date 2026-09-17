import { useEffect, useRef, useState } from "react";
import { mintVoiceTicket } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { useLocale, useT } from "../lib/locale.tsx";
import { storageGet } from "../lib/storage.ts";
import {
	encodeVoiceClient,
	parseVoiceMicMode,
	parseVoiceServerMessage,
	VOICE_MIC_STORAGE_KEY,
	type VoiceMicMode,
} from "../lib/voice.ts";
import { Body, ErrorText, Muted, Paper, PrimaryButton } from "./ui.tsx";

export default function TalkPanel({
	uuid,
	repo,
	owner,
}: {
	uuid: string;
	repo: string;
	owner?: string;
}) {
	const t = useT();
	const { locale } = useLocale();
	const auth = useAuth();
	const [mode, setMode] = useState<VoiceMicMode>("hold");
	const [state, setState] = useState<
		"idle" | "listening" | "talking" | "working"
	>("idle");
	const [billed, setBilled] = useState(false);
	const [error, setError] = useState("");
	const [transcript, setTranscript] = useState("");
	const socketRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		void storageGet(VOICE_MIC_STORAGE_KEY).then((stored) => {
			setMode(parseVoiceMicMode(stored));
		});
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: unmount only
	useEffect(() => () => stopAll(), []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: arm always-listen once per board
	useEffect(() => {
		if (mode !== "always" || !uuid || !auth.token) {
			return;
		}
		void startSession();
		return () => stopAll();
	}, [mode, uuid, auth.token]);

	async function startSession() {
		if (!uuid || !auth.token || socketRef.current) {
			return;
		}
		setError("");
		try {
			const ticket = await mintVoiceTicket(auth.token, uuid);
			const socket = new WebSocket(ticket.wsUrl);
			socketRef.current = socket;
			socket.onmessage = (event) => {
				if (typeof event.data !== "string") {
					return;
				}
				const message = parseVoiceServerMessage(event.data);
				if (!message) {
					return;
				}
				if (message.type === "transcript" && message.text) {
					setTranscript((prev) => `${prev}${message.text}`.slice(-4000));
				}
				if (message.state) {
					setState(message.state);
				}
				if (typeof message.billed === "boolean") {
					setBilled(message.billed);
				}
				if (message.type === "error" && message.text) {
					setError(message.text);
				}
			};
			socket.onclose = () => {
				socketRef.current = null;
				setBilled(false);
				setState("idle");
			};
			await new Promise<void>((resolve, reject) => {
				socket.onopen = () => resolve();
				socket.onerror = () => reject(new Error("voice connect failed"));
			});
			socket.send(
				encodeVoiceClient({
					type: "hello",
					locale,
					mode,
					repo,
					owner,
				}),
			);
			socket.send(
				encodeVoiceClient({ type: "start", repo, owner, locale, mode }),
			);
			setState("talking");
			setBilled(true);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : t("talk.micDenied"));
			stopAll();
		}
	}

	function stopAll() {
		const socket = socketRef.current;
		if (socket) {
			if (socket.readyState === WebSocket.OPEN) {
				socket.send(encodeVoiceClient({ type: "stop" }));
			}
			socket.close();
		}
		socketRef.current = null;
		setBilled(false);
		setState("idle");
	}

	const chip =
		state === "working"
			? t("talk.working")
			: billed
				? t("talk.talking")
				: t("talk.title");

	return (
		<Paper>
			<Body>{t("talk.title")}</Body>
			<Muted>{chip}</Muted>
			<Muted>{t("talk.hint")}</Muted>
			<ErrorText>{error}</ErrorText>
			<PrimaryButton
				label={billed ? t("talk.stop") : t("talk.press")}
				onPress={() => {
					if (billed) {
						stopAll();
						return;
					}
					void startSession();
				}}
			/>
			{transcript ? <Muted>{transcript}</Muted> : null}
		</Paper>
	);
}
