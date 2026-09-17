import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	encodeVoiceMessage,
	matchesWakePhrase,
	parseVoiceId,
	parseVoiceServerMessage,
	VOICE_PATH,
	VOICE_SAMPLE_RATE,
	VOICE_SPEAKERS,
	WAKE_PHRASE_LABEL,
} from "gpio-companion";
import { useEffect, useRef, useState } from "react";
import { useLocale, useT } from "../hooks/useLocale.tsx";
import { useVoiceMic } from "../hooks/useVoiceMic.ts";

type SpeechRec = {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onresult:
		| ((event: {
				results: ArrayLike<ArrayLike<{ transcript: string }>>;
		  }) => void)
		| null;
	onerror: (() => void) | null;
	start(): void;
	stop(): void;
};

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
	const { mode, voice, setVoice } = useVoiceMic();
	const [state, setState] = useState<
		"idle" | "listening" | "talking" | "working"
	>("idle");
	const [billed, setBilled] = useState(false);
	const [error, setError] = useState("");
	const [transcript, setTranscript] = useState("");
	const socketRef = useRef<WebSocket | null>(null);
	const audioRef = useRef<AudioContext | null>(null);
	const playRef = useRef<number>(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: unmount only
	useEffect(() => {
		return () => {
			stopAll();
		};
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: arm always-listen once per board
	useEffect(() => {
		if (mode !== "always" || !uuid) {
			return;
		}
		void startSession();
		return () => {
			stopAll();
		};
	}, [mode, uuid]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: local wake listener
	useEffect(() => {
		if (mode !== "wake" || !uuid) {
			return;
		}
		const Speech =
			(
				window as unknown as {
					SpeechRecognition?: new () => SpeechRec;
					webkitSpeechRecognition?: new () => SpeechRec;
				}
			).SpeechRecognition ||
			(
				window as unknown as {
					webkitSpeechRecognition?: new () => SpeechRec;
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
		rec.onerror = () => undefined;
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
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const socket = new WebSocket(
			`${protocol}//${window.location.host}${VOICE_PATH}?uuid=${encodeURIComponent(uuid)}`,
		);
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
		socket.onerror = () => {
			setError(t("talk.micDenied"));
		};
		await new Promise<void>((resolve) => {
			socket.onopen = () => resolve();
		});
		socket.send(
			encodeVoiceMessage({
				v: 1,
				type: "hello",
				locale,
				mode,
				repo,
				owner,
				voice,
			}),
		);
		socket.send(
			encodeVoiceMessage({
				v: 1,
				type: "start",
				repo,
				owner,
				locale,
				mode,
				voice,
			}),
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
		const start = Math.max(context.currentTime, playRef.current);
		node.start(start);
		playRef.current = start + audio.duration;
	}

	function stopAll() {
		const socket = socketRef.current;
		if (socket) {
			if (socket.readyState === WebSocket.OPEN) {
				socket.send(encodeVoiceMessage({ v: 1, type: "stop" }));
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
		<Paper className="min-w-0 overflow-x-hidden p-3" elevation={1}>
			<Stack spacing={1}>
				<Stack
					direction="row"
					spacing={1}
					className="flex-wrap items-center justify-between"
				>
					<Typography variant="subtitle1">{t("talk.title")}</Typography>
					<Chip label={chip} size="small" variant="outlined" />
				</Stack>
				<Typography color="secondary">{t("talk.hint")}</Typography>
				<Typography>
					{t("talk.sayWake", { phrase: WAKE_PHRASE_LABEL })}
				</Typography>
				<Select
					name="talk-voice"
					label={t("talk.voice")}
					value={voice}
					onSelect={(next) => setVoice(parseVoiceId(next))}
					className="w-full max-w-xs"
				>
					{VOICE_SPEAKERS.map((speaker) => (
						<option key={speaker.id} value={speaker.id}>
							{speaker.name}
						</option>
					))}
				</Select>
				{error ? <Typography color="error">{error}</Typography> : null}
				<Stack direction="row" spacing={1} className="flex-wrap">
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
						className="max-h-48 overflow-auto whitespace-pre-wrap break-all"
					>
						{transcript}
					</Typography>
				) : null}
			</Stack>
		</Paper>
	);
}
