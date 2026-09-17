import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useRef, useState } from "react";
import { mintVoiceTicket } from "../api";
import {
	encodeVoiceClient,
	matchesWakePhrase,
	parseVoiceId,
	parseVoiceMicMode,
	parseVoiceServerMessage,
	VOICE_ID_STORAGE_KEY,
	VOICE_MIC_STORAGE_KEY,
	VOICE_SAMPLE_RATE,
	VOICE_SPEAKERS,
	WAKE_PHRASE_LABEL,
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
	const [voice, setVoiceState] = useState(() =>
		parseVoiceId(
			typeof window === "undefined"
				? "eve"
				: window.localStorage.getItem(VOICE_ID_STORAGE_KEY),
		),
	);
	const [state, setState] = useState<
		"idle" | "listening" | "talking" | "working"
	>("idle");
	const [billed, setBilled] = useState(false);
	const [error, setError] = useState("");
	const [heard, setHeard] = useState("");
	const socketRef = useRef<WebSocket | null>(null);
	const audioRef = useRef<AudioContext | null>(null);
	const streamRef = useRef<MediaStream | null>(null);

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
		setHeard("");
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
			if (message.type === "heard" && message.text) {
				setHeard(message.text.trim());
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
				voice,
			}),
		);
		socket.send(
			encodeVoiceClient({ type: "start", repo, owner, locale, mode, voice }),
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
		const media = navigator.mediaDevices;
		if (!media?.getUserMedia) {
			throw new Error("mic");
		}
		let stream: MediaStream;
		try {
			stream = await media.getUserMedia({ audio: true });
		} catch {
			stream = await media.getUserMedia({
				audio: { echoCancellation: true, noiseSuppression: true },
			});
		}
		streamRef.current = stream;
		const context = new AudioContext({ sampleRate: VOICE_SAMPLE_RATE });
		audioRef.current = context;
		if (context.state === "suspended") {
			await context.resume();
		}
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
		for (const track of streamRef.current?.getTracks() ?? []) {
			track.stop();
		}
		streamRef.current = null;
		void audioRef.current?.close();
		audioRef.current = null;
		setBilled(false);
		setHeard("");
		setState("idle");
	}

	const live =
		billed ||
		state === "talking" ||
		state === "listening" ||
		state === "working";

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
				<Typography>
					{t("talk.sayWake", { phrase: WAKE_PHRASE_LABEL })}
				</Typography>
				<Select
					name="talk-voice"
					label={t("talk.voice")}
					value={voice}
					onSelect={(next) => {
						const id = parseVoiceId(next);
						setVoiceState(id);
						try {
							window.localStorage.setItem(VOICE_ID_STORAGE_KEY, id);
						} catch {
							undefined;
						}
					}}
					sx={{ maxWidth: 280 }}
				>
					{VOICE_SPEAKERS.map((speaker) => (
						<option key={speaker.id} value={speaker.id}>
							{speaker.name}
						</option>
					))}
				</Select>
				{error ? <Typography color="error">{error}</Typography> : null}
				{live ? (
					<Stack spacing={1} sx={{ alignItems: "center", pt: 1 }}>
						{heard ? (
							<div className="talk-heard">{heard}</div>
						) : (
							<Typography color="secondary" sx={{ fontSize: "0.85rem" }}>
								{t("talk.listening")}
							</Typography>
						)}
						<button
							type="button"
							className="talk-mic"
							onClick={() => stopAll()}
							aria-label={t("talk.stop")}
						>
							<span className="talk-mic-pulse" />
							<svg
								width="28"
								height="28"
								viewBox="0 0 24 24"
								aria-hidden
								style={{ position: "relative", fill: "currentColor" }}
							>
								<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
							</svg>
						</button>
					</Stack>
				) : (
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
								variant="contained"
								size="small"
								onClick={() => void startSession()}
							>
								{t("talk.title")}
							</Button>
						)}
					</Stack>
				)}
			</Stack>
		</Paper>
	);
}
