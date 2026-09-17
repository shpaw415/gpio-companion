import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useRef, useState } from "react";
import { mintVoiceTicket } from "../api";
import {
	encodeVoiceClient,
	matchesWakePhrase,
	parseVoiceMicMode,
	parseVoiceServerMessage,
	VOICE_MIC_STORAGE_KEY,
	VOICE_SAMPLE_RATE,
} from "../lib/voice";
import { useLocale, useT } from "../locale";

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
	const mode = parseVoiceMicMode(
		typeof window === "undefined"
			? "hold"
			: window.localStorage.getItem(VOICE_MIC_STORAGE_KEY),
	);
	const [state, setState] = useState<
		"idle" | "listening" | "talking" | "working"
	>("idle");
	const [billed, setBilled] = useState(false);
	const [error, setError] = useState("");
	const [transcript, setTranscript] = useState("");
	const socketRef = useRef<WebSocket | null>(null);
	const audioRef = useRef<AudioContext | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: unmount only
	useEffect(() => () => stopAll(), []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: arm always-listen once per board
	useEffect(() => {
		if (mode !== "always" || !uuid) {
			return;
		}
		void startSession();
		return () => stopAll();
	}, [mode, uuid]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: local wake listener
	useEffect(() => {
		if (mode !== "wake" || !uuid) {
			return;
		}
		const Speech = (
			window as unknown as {
				webkitSpeechRecognition?: new () => {
					continuous: boolean;
					interimResults: boolean;
					lang: string;
					onresult:
						| ((event: {
								results: ArrayLike<ArrayLike<{ transcript: string }>>;
						  }) => void)
						| null;
					start(): void;
					stop(): void;
				};
			}
		).webkitSpeechRecognition;
		if (!Speech) {
			setState("listening");
			return;
		}
		const rec = new Speech();
		rec.continuous = true;
		rec.interimResults = true;
		rec.lang = locale.startsWith("fr") ? "fr-FR" : "en-US";
		rec.onresult = (event) => {
			const last = event.results[event.results.length - 1];
			const text = last?.[0]?.transcript ?? "";
			if (matchesWakePhrase(text)) {
				void startSession();
			}
		};
		try {
			rec.start();
			setState("listening");
		} catch {
			setState("listening");
		}
		return () => {
			try {
				rec.stop();
			} catch {
				undefined;
			}
		};
	}, [mode, uuid, locale]);

	async function startSession() {
		if (!uuid || socketRef.current) {
			return;
		}
		setError("");
		const ticket = await mintVoiceTicket(uuid);
		const socket = new WebSocket(ticket.wsUrl);
		socket.binaryType = "arraybuffer";
		socketRef.current = socket;
		socket.onmessage = (event) => {
			if (typeof event.data !== "string") {
				void playPcm(event.data as ArrayBuffer);
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
			setState(mode === "wake" ? "listening" : "idle");
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
		try {
			await startMic(socket);
			setState("talking");
			setBilled(true);
		} catch {
			setError(t("talk.micDenied"));
			stopAll();
		}
	}

	async function startMic(socket: WebSocket) {
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: { echoCancellation: true, noiseSuppression: true },
		});
		const context = new AudioContext({ sampleRate: VOICE_SAMPLE_RATE });
		audioRef.current = context;
		const source = context.createMediaStreamSource(stream);
		const processor = context.createScriptProcessor(4096, 1, 1);
		processor.onaudioprocess = (event) => {
			if (socket.readyState !== WebSocket.OPEN) {
				return;
			}
			const input = event.inputBuffer.getChannelData(0);
			const pcm = new Int16Array(input.length);
			for (let i = 0; i < input.length; i += 1) {
				const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
				pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
			}
			socket.send(pcm.buffer);
		};
		source.connect(processor);
		processor.connect(context.destination);
	}

	async function playPcm(buffer: ArrayBuffer) {
		const context =
			audioRef.current ?? new AudioContext({ sampleRate: VOICE_SAMPLE_RATE });
		audioRef.current = context;
		const pcm = new Int16Array(buffer);
		const floats = new Float32Array(pcm.length);
		for (let i = 0; i < pcm.length; i += 1) {
			floats[i] = (pcm[i] ?? 0) / 32768;
		}
		const audio = context.createBuffer(1, floats.length, VOICE_SAMPLE_RATE);
		audio.copyToChannel(floats, 0);
		const node = context.createBufferSource();
		node.buffer = audio;
		node.connect(context.destination);
		node.start();
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
		void audioRef.current?.close();
		audioRef.current = null;
		setBilled(false);
		setState("idle");
	}

	const chip =
		state === "working"
			? t("talk.working")
			: billed
				? t("talk.talking")
				: state === "listening"
					? t("talk.listening")
					: t("talk.title");

	return (
		<Paper sx={{ p: 1.5, minWidth: 0 }} elevation={1}>
			<Stack spacing={1}>
				<Stack
					direction="row"
					spacing={1}
					sx={{ alignItems: "center", justifyContent: "space-between" }}
				>
					<Typography variant="subtitle1">{t("talk.title")}</Typography>
					<Chip label={chip} size="small" variant="outlined" />
				</Stack>
				<Typography color="secondary">{t("talk.hint")}</Typography>
				{error ? <Typography color="error">{error}</Typography> : null}
				<Stack direction="row" spacing={1}>
					{mode === "hold" ? (
						<Button
							variant="contained"
							size="small"
							onPointerDown={() => void startSession()}
							onPointerUp={() => stopAll()}
							onPointerLeave={() => stopAll()}
						>
							{t("talk.press")}
						</Button>
					) : (
						<Button
							variant={billed ? "outlined" : "contained"}
							size="small"
							onClick={() => {
								if (billed) {
									stopAll();
									return;
								}
								void startSession();
							}}
						>
							{billed ? t("talk.stop") : t("talk.title")}
						</Button>
					)}
				</Stack>
				{transcript ? (
					<Typography
						color="secondary"
						sx={{ maxHeight: 192, overflow: "auto", whiteSpace: "pre-wrap" }}
					>
						{transcript}
					</Typography>
				) : null}
			</Stack>
		</Paper>
	);
}
