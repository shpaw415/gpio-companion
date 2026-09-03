import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	breadboardPinOffset,
	breadboardRows,
	breadboardSize,
	GPIO_COMPANION_HEADER_TYPE,
	headerPinOffset,
	headerSize,
	isBreadboardType,
	type Point,
	parseWokwiDiagram,
	partOrigin,
	rotatePoint,
	splitEndpoint,
	type WokwiDiagram,
	type WokwiPart,
	wirePath,
} from "gpio-companion";
import {
	type CSSProperties,
	createElement,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

type Props = {
	diagramText?: string | null;
	previewUrl?: string | null;
};

type PinInfo = { name: string; x: number; y: number };

export default function BreadboardViewer({ diagramText, previewUrl }: Props) {
	const parsed = useMemo(() => parseDiagram(diagramText), [diagramText]);
	const [activeStep, setActiveStep] = useState(0);
	const [elementsReady, setElementsReady] = useState(0);
	const partRefs = useRef(new Map<string, HTMLElement>());

	useEffect(() => {
		void import("@wokwi/elements").then(() => {
			setElementsReady((value) => value + 1);
		});
	}, []);

	const diagram = parsed.diagram;
	if (diagram) {
		const highlight = diagram.steps?.[activeStep]?.highlight ?? [];
		const pins = collectPins(diagram, partRefs.current);
		const bounds = canvasBounds(diagram);
		return (
			<Paper className="overflow-hidden p-4" elevation={1}>
				<Typography variant="subtitle1" className="mb-2">
					Breadboard
				</Typography>
				<div
					className="relative overflow-auto bg-slate-950"
					style={{ minHeight: 280 }}
				>
					<div
						className="relative"
						style={{ width: bounds.width, height: bounds.height }}
					>
						{diagram.parts.map((part) =>
							part.hide
								? null
								: renderPart(part, highlight.includes(part.id), (el) => {
										if (el) {
											partRefs.current.set(part.id, el);
										} else {
											partRefs.current.delete(part.id);
										}
									}),
						)}
						<svg
							aria-label="Breadboard wiring"
							className="pointer-events-none absolute inset-0"
							height={bounds.height}
							key={elementsReady}
							role="img"
							width={bounds.width}
						>
							<title>Breadboard wiring</title>
							{diagram.connections.map((connection) => {
								const [from, to, color, instructions] = connection;
								const start = endpointPoint(diagram, from, pins);
								const end = endpointPoint(diagram, to, pins);
								if (!start || !end) {
									return null;
								}
								const points = wirePath(start, end, instructions)
									.map((point) => `${point.x},${point.y}`)
									.join(" ");
								const hot =
									highlight.length === 0 ||
									highlight.includes(splitEndpoint(from).partId) ||
									highlight.includes(splitEndpoint(to).partId);
								return (
									<polyline
										key={`${from}->${to}`}
										fill="none"
										points={points}
										stroke={color || "#22c55e"}
										strokeWidth={hot ? 3 : 1.5}
										strokeOpacity={hot ? 1 : 0.35}
									/>
								);
							})}
						</svg>
					</div>
				</div>
				{diagram.steps?.length ? (
					<Stack spacing={1} className="mt-3">
						{diagram.steps.map((step, index) => (
							<button
								key={step.text}
								className={`rounded px-3 py-2 text-left text-sm ${
									index === activeStep
										? "bg-slate-800 text-white"
										: "text-slate-300"
								}`}
								onClick={() => setActiveStep(index)}
								type="button"
							>
								{index + 1}. {step.text}
							</button>
						))}
					</Stack>
				) : null}
			</Paper>
		);
	}

	if (previewUrl) {
		return (
			<Paper className="overflow-hidden" elevation={1}>
				<img
					alt="Breadboard preview"
					className="w-full bg-white"
					src={previewUrl}
				/>
				<Typography color="secondary" className="px-4 py-2">
					Breadboard
				</Typography>
			</Paper>
		);
	}

	if (diagramText) {
		return (
			<Paper className="p-4" elevation={1}>
				<Typography variant="subtitle1" className="mb-2">
					Breadboard
				</Typography>
				{parsed.error ? (
					<Typography color="error" className="mb-2">
						{parsed.error}
					</Typography>
				) : null}
				<pre className="max-h-[32rem] overflow-auto text-xs">
					{diagramText.slice(0, 8000)}
				</pre>
			</Paper>
		);
	}

	return (
		<Paper className="p-4 min-[900px]:p-6" elevation={1}>
			<Typography color="secondary">
				No breadboard/diagram.json on GitHub yet.
			</Typography>
		</Paper>
	);
}

function parseDiagram(text?: string | null): {
	diagram: WokwiDiagram | null;
	error: string | null;
} {
	if (!text?.trim()) {
		return { diagram: null, error: null };
	}
	try {
		return { diagram: parseWokwiDiagram(text), error: null };
	} catch (error) {
		return {
			diagram: null,
			error: error instanceof Error ? error.message : "invalid diagram",
		};
	}
}

function renderPart(
	part: WokwiPart,
	hot: boolean,
	ref: (el: HTMLElement | null) => void,
) {
	const origin = partOrigin(part);
	const style: CSSProperties = {
		position: "absolute",
		left: origin.x,
		top: origin.y,
		transform: part.rotate ? `rotate(${part.rotate}deg)` : undefined,
		transformOrigin: "top left",
		opacity: hot ? 1 : 0.9,
	};
	if (isBreadboardType(part.type)) {
		return (
			<div key={part.id} style={style}>
				<BreadboardSvg type={part.type} />
			</div>
		);
	}
	if (part.type === GPIO_COMPANION_HEADER_TYPE) {
		return (
			<div key={part.id} style={style}>
				<HeaderSvg hardware={part.attrs?.hardware ?? "raspberrypi"} />
			</div>
		);
	}
	return createElement(part.type, {
		key: part.id,
		ref,
		id: part.id,
		style,
		...part.attrs,
	});
}

function BreadboardSvg({ type }: { type: string }) {
	const { width, height } = breadboardSize(type);
	const rows = breadboardRows(type);
	const holes: Point[] = [];
	for (let row = 1; row <= rows; row += 1) {
		for (const col of "abcdefghij") {
			const point = breadboardPinOffset(type, `${row}${col}`);
			if (point) {
				holes.push(point);
			}
		}
	}
	for (const rail of ["tp", "tn", "bp", "bn"]) {
		for (let index = 1; index <= 20; index += 1) {
			const point = breadboardPinOffset(type, `${rail}.${index}`);
			if (point) {
				holes.push(point);
			}
		}
	}
	return (
		<svg
			aria-label="Breadboard"
			height={height}
			role="img"
			viewBox={`0 0 ${width} ${height}`}
			width={width}
		>
			<title>Breadboard</title>
			<rect width={width} height={height} fill="#d6c7a1" rx={6} />
			{holes.map((hole) => (
				<circle
					key={`${hole.x}-${hole.y}`}
					cx={hole.x}
					cy={hole.y}
					r={2}
					fill="#1e293b"
				/>
			))}
		</svg>
	);
}

function HeaderSvg({ hardware }: { hardware: string }) {
	const { width, height } = headerSize();
	const pins = Array.from({ length: 40 }, (_, index) => index + 1);
	return (
		<svg
			aria-label={`${hardware} GPIO header`}
			height={height}
			role="img"
			viewBox={`0 0 ${width} ${height}`}
			width={width}
		>
			<title>{hardware} GPIO header</title>
			<rect width={width} height={height} fill="#111827" rx={4} />
			<text x={4} y={10} fill="#94a3b8" fontSize={8}>
				{hardware === "orangepi" ? "Orange Pi" : "Raspberry Pi"}
			</text>
			{pins.map((pin) => {
				const point = headerPinOffset(String(pin));
				if (!point) {
					return null;
				}
				return (
					<circle
						key={pin}
						cx={point.x}
						cy={point.y}
						r={2.2}
						fill={pin === 1 ? "#fbbf24" : "#e2e8f0"}
					/>
				);
			})}
		</svg>
	);
}

function collectPins(
	diagram: WokwiDiagram,
	refs: Map<string, HTMLElement>,
): Map<string, Point> {
	const pins = new Map<string, Point>();
	for (const part of diagram.parts) {
		const origin = partOrigin(part);
		const rotate = part.rotate ?? 0;
		if (isBreadboardType(part.type)) {
			const rows = breadboardRows(part.type);
			for (let row = 1; row <= rows; row += 1) {
				for (const col of "abcdefghij") {
					addOffsetPin(pins, part, `${row}${col}`, origin, rotate, (pin) =>
						breadboardPinOffset(part.type, pin),
					);
				}
			}
			for (const rail of ["tp", "tn", "bp", "bn"]) {
				for (let index = 1; index <= 20; index += 1) {
					addOffsetPin(pins, part, `${rail}.${index}`, origin, rotate, (pin) =>
						breadboardPinOffset(part.type, pin),
					);
				}
			}
			continue;
		}
		if (part.type === GPIO_COMPANION_HEADER_TYPE) {
			for (let pin = 1; pin <= 40; pin += 1) {
				addOffsetPin(pins, part, String(pin), origin, rotate, headerPinOffset);
			}
			continue;
		}
		const el = refs.get(part.id) as
			| (HTMLElement & { pinInfo?: PinInfo[] })
			| undefined;
		for (const info of el?.pinInfo ?? []) {
			const offset = rotatePoint({ x: info.x, y: info.y }, rotate);
			pins.set(`${part.id}:${info.name}`, {
				x: origin.x + offset.x,
				y: origin.y + offset.y,
			});
		}
	}
	return pins;
}

function addOffsetPin(
	pins: Map<string, Point>,
	part: WokwiPart,
	pin: string,
	origin: Point,
	rotate: number,
	offsetOf: (pin: string) => Point | null,
) {
	const offset = offsetOf(pin);
	if (!offset) {
		return;
	}
	const rotated = rotatePoint(offset, rotate);
	pins.set(`${part.id}:${pin}`, {
		x: origin.x + rotated.x,
		y: origin.y + rotated.y,
	});
}

function endpointPoint(
	diagram: WokwiDiagram,
	endpoint: string,
	pins: Map<string, Point>,
): Point | null {
	const direct = pins.get(endpoint);
	if (direct) {
		return direct;
	}
	const { partId } = splitEndpoint(endpoint);
	const part = diagram.parts.find((item) => item.id === partId);
	return part ? partOrigin(part) : null;
}

function canvasBounds(diagram: WokwiDiagram): {
	width: number;
	height: number;
} {
	let width = 320;
	let height = 240;
	for (const part of diagram.parts) {
		const origin = partOrigin(part);
		const size = isBreadboardType(part.type)
			? breadboardSize(part.type)
			: part.type === GPIO_COMPANION_HEADER_TYPE
				? headerSize()
				: { width: 80, height: 80 };
		width = Math.max(width, origin.x + size.width + 24);
		height = Math.max(height, origin.y + size.height + 24);
	}
	return { width, height };
}
