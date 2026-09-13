import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	BREADBOARD_LEFT_COLS,
	BREADBOARD_PITCH,
	BREADBOARD_RAILS,
	BREADBOARD_RIGHT_COLS,
	breadboardHasRails,
	breadboardPinNames,
	breadboardPinOffset,
	breadboardRows,
	breadboardSize,
	GPIO_COMPANION_HEADER_TYPE,
	headerPinOffset,
	headerSize,
	isBreadboardType,
	type PartPinInfo,
	type Point,
	parseWokwiDiagram,
	partPinsFor,
	rotatePoint,
	snapPartPlacement,
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
	livePins?: Record<number, 0 | 1>;
};

type PinInfo = PartPinInfo;

export default function BreadboardViewer({
	diagramText,
	previewUrl,
	livePins,
}: Props) {
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
		const bounds = canvasBounds(diagram, partRefs.current);
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
								: renderPart(
										diagram,
										part,
										highlight.includes(part.id),
										livePins,
										partRefs.current.get(part.id),
										(el) => {
											if (el) {
												partRefs.current.set(part.id, el);
											} else {
												partRefs.current.delete(part.id);
											}
										},
									),
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
								if (
									Math.hypot(end.x - start.x, end.y - start.y) < 2 &&
									instructions.length === 0
								) {
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

function elementPins(el?: HTMLElement): PartPinInfo[] | undefined {
	const pins = (el as (HTMLElement & { pinInfo?: PinInfo[] }) | undefined)
		?.pinInfo;
	return pins?.length ? pins : undefined;
}

function renderPart(
	diagram: WokwiDiagram,
	part: WokwiPart,
	hot: boolean,
	livePins: Record<number, 0 | 1> | undefined,
	el: HTMLElement | undefined,
	ref: (el: HTMLElement | null) => void,
) {
	const placement = snapPartPlacement(part, diagram, elementPins(el));
	const style: CSSProperties = {
		position: "absolute",
		left: placement.origin.x,
		top: placement.origin.y,
		transform: placement.rotate ? `rotate(${placement.rotate}deg)` : undefined,
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
				<HeaderSvg
					hardware={part.attrs?.hardware ?? "raspberrypi"}
					livePins={livePins}
				/>
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
	for (const pin of breadboardPinNames(type)) {
		const point = breadboardPinOffset(type, pin);
		if (point) {
			holes.push(point);
		}
	}
	const first = breadboardPinOffset(type, "1a");
	const last = breadboardPinOffset(type, `${rows}e`);
	const colF = breadboardPinOffset(type, "1f");
	const grooveLeft = last ? last.x + BREADBOARD_PITCH * 0.6 : 0;
	const grooveRight = colF ? colF.x - BREADBOARD_PITCH * 0.6 : 0;
	const grooveTop = first ? first.y - BREADBOARD_PITCH * 0.6 : 0;
	const grooveBottom = last ? last.y + BREADBOARD_PITCH * 0.6 : 0;
	const labelY = BREADBOARD_PITCH * 1.15;
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
			{grooveRight > grooveLeft ? (
				<rect
					x={grooveLeft}
					y={grooveTop}
					width={grooveRight - grooveLeft}
					height={grooveBottom - grooveTop}
					fill="#c4b48e"
					rx={2}
				/>
			) : null}
			{breadboardHasRails(type)
				? BREADBOARD_RAILS.map((rail) => {
						const top = breadboardPinOffset(type, `${rail}.1`);
						const bottom = breadboardPinOffset(type, `${rail}.${rows}`);
						if (!top || !bottom) {
							return null;
						}
						const positive = rail.endsWith("p");
						return (
							<line
								key={`${rail}-line`}
								x1={top.x}
								y1={top.y - 4}
								x2={bottom.x}
								y2={bottom.y + 4}
								stroke={positive ? "#c24141" : "#3b6ea5"}
								strokeWidth={1.2}
							/>
						);
					})
				: null}
			{holes.map((hole) => (
				<circle
					key={`${hole.x}-${hole.y}`}
					cx={hole.x}
					cy={hole.y}
					r={2}
					fill="#1e293b"
				/>
			))}
			{[...BREADBOARD_LEFT_COLS, ...BREADBOARD_RIGHT_COLS].map((col) => {
				const point = breadboardPinOffset(type, `1${col}`);
				if (!point) {
					return null;
				}
				return (
					<text
						key={`col-${col}`}
						x={point.x}
						y={labelY}
						fill="#5b4f3a"
						fontSize={7}
						textAnchor="middle"
					>
						{col}
					</text>
				);
			})}
			{Array.from({ length: rows }, (_, index) => index + 1)
				.filter((row) => row === 1 || row === rows || row % 5 === 0)
				.map((row) => {
					const point = breadboardPinOffset(type, `${row}a`);
					if (!point) {
						return null;
					}
					return (
						<text
							key={`row-${row}`}
							x={(grooveLeft + grooveRight) / 2}
							y={point.y + 2.5}
							fill="#5b4f3a"
							fontSize={7}
							textAnchor="middle"
						>
							{row}
						</text>
					);
				})}
			{breadboardHasRails(type)
				? (
						[
							["tp", "+", "#c24141"],
							["tn", "−", "#3b6ea5"],
							["bn", "−", "#3b6ea5"],
							["bp", "+", "#c24141"],
						] as const
					).map(([rail, mark, fill]) => {
						const point = breadboardPinOffset(type, `${rail}.1`);
						if (!point) {
							return null;
						}
						return (
							<text
								key={`${rail}-mark`}
								x={point.x}
								y={labelY}
								fill={fill}
								fontSize={8}
								fontWeight={700}
								textAnchor="middle"
							>
								{mark}
							</text>
						);
					})
				: null}
		</svg>
	);
}

function headerFill(pin: number, livePins?: Record<number, 0 | 1>): string {
	if (livePins?.[pin] === 1) {
		return "#22c55e";
	}
	if (livePins?.[pin] === 0) {
		return "#475569";
	}
	return pin === 1 ? "#fbbf24" : "#e2e8f0";
}

function HeaderSvg({
	hardware,
	livePins,
}: {
	hardware: string;
	livePins?: Record<number, 0 | 1>;
}) {
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
						fill={headerFill(pin, livePins)}
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
		const placement = snapPartPlacement(
			part,
			diagram,
			elementPins(refs.get(part.id)),
		);
		const origin = placement.origin;
		const rotate = placement.rotate;
		if (isBreadboardType(part.type)) {
			for (const pin of breadboardPinNames(part.type)) {
				addOffsetPin(pins, part, pin, origin, rotate, (name) =>
					breadboardPinOffset(part.type, name),
				);
			}
			continue;
		}
		if (part.type === GPIO_COMPANION_HEADER_TYPE) {
			for (let pin = 1; pin <= 40; pin += 1) {
				addOffsetPin(pins, part, String(pin), origin, rotate, headerPinOffset);
			}
			continue;
		}
		for (const info of partPinsFor(part.type, elementPins(refs.get(part.id)))) {
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
	if (!part) {
		return null;
	}
	return snapPartPlacement(part, diagram).origin;
}

function canvasBounds(
	diagram: WokwiDiagram,
	refs: Map<string, HTMLElement>,
): {
	width: number;
	height: number;
} {
	let width = 320;
	let height = 240;
	for (const part of diagram.parts) {
		const placement = snapPartPlacement(
			part,
			diagram,
			elementPins(refs.get(part.id)),
		);
		const origin = placement.origin;
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
