import FitScreenIcon from "@material-design-icons/svg/filled/fit_screen.svg";
import FullscreenIcon from "@material-design-icons/svg/filled/fullscreen.svg";
import FullscreenExitIcon from "@material-design-icons/svg/filled/fullscreen_exit.svg";
import ZoomInIcon from "@material-design-icons/svg/filled/zoom_in.svg";
import ZoomOutIcon from "@material-design-icons/svg/filled/zoom_out.svg";
import IconButton from "@shpaw415/mui-lite/IconButton";
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
	type HeaderPinDef,
	headerPinOffset,
	headerPinsForBoard,
	headerSize,
	isBreadboardType,
	isHardwareId,
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
	type ReactNode,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	fitContain,
	fitRect,
	panBy,
	type Viewport,
	zoomAt,
} from "../lib/viewport-zoom.ts";

type Props = {
	diagramText?: string | null;
	previewUrl?: string | null;
	livePins?: Record<number, 0 | 1>;
	boardModel?: string | null;
};

type PinInfo = PartPinInfo;

type ZoomCamera = {
	viewportRef: React.RefObject<HTMLDivElement | null>;
	view: Viewport;
	percent: number;
	fit: () => void;
	fitTo: (rect: {
		x: number;
		y: number;
		width: number;
		height: number;
	}) => void;
	zoomBy: (factor: number) => void;
	setView: (update: Viewport | ((current: Viewport) => Viewport)) => void;
	onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
	onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
	onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export default function BreadboardViewer({
	diagramText,
	previewUrl,
	livePins,
	boardModel,
}: Props) {
	const parsed = useMemo(() => parseDiagram(diagramText), [diagramText]);
	const diagram = parsed.diagram;
	if (diagram) {
		return (
			<DiagramBoard
				diagram={diagram}
				livePins={livePins}
				boardModel={boardModel}
			/>
		);
	}

	if (previewUrl) {
		return <PreviewBoard previewUrl={previewUrl} />;
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

function DiagramBoard({
	diagram,
	livePins,
	boardModel,
}: {
	diagram: WokwiDiagram;
	livePins?: Record<number, 0 | 1>;
	boardModel?: string | null;
}) {
	const [activeStep, setActiveStep] = useState(0);
	const [expanded, setExpanded] = useState(false);
	const [seed, setSeed] = useState<string[] | null>(null);
	const [wireKey, setWireKey] = useState<string | null>(null);
	const [elementsReady, setElementsReady] = useState(0);
	const partRefs = useRef(new Map<string, HTMLElement>());
	const pins = collectPins(diagram, partRefs.current, boardModel);
	const bounds = canvasBounds(diagram, partRefs.current, boardModel);
	const camera = useZoomCamera(bounds.width, bounds.height, expanded, () => {
		setSeed(null);
		setWireKey(null);
	});
	const highlight = seed ?? diagram.steps?.[activeStep]?.highlight ?? [];

	useEffect(() => {
		void import("@wokwi/elements").then(() => {
			setElementsReady((value) => value + 1);
		});
	}, []);

	useEffect(() => {
		if (!expanded) {
			return;
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setExpanded(false);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [expanded]);

	function selectPart(partId: string) {
		setSeed([partId]);
		setWireKey(null);
	}

	function selectWire(from: string, to: string) {
		setWireKey(`${from}->${to}`);
		setSeed([splitEndpoint(from).partId, splitEndpoint(to).partId]);
	}

	function selectStep(index: number) {
		setActiveStep(index);
		setSeed(null);
		setWireKey(null);
		const ids = diagram.steps?.[index]?.highlight;
		if (ids?.length) {
			camera.fitTo(partsRect(diagram, ids, partRefs.current, boardModel));
		} else {
			camera.fit();
		}
	}

	return (
		<BoardShell
			camera={camera}
			expanded={expanded}
			onToggleExpand={() => setExpanded((value) => !value)}
		>
			<ZoomSurface camera={camera} expanded={expanded}>
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
									partHot(part, highlight),
									livePins,
									boardModel,
									partRefs.current.get(part.id),
									(el) => {
										if (el) {
											partRefs.current.set(part.id, el);
										} else {
											partRefs.current.delete(part.id);
										}
									},
									() => selectPart(part.id),
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
							const key = `${from}->${to}`;
							const hot = wireHot(from, to, highlight, wireKey, key);
							return (
								// biome-ignore lint/a11y/useSemanticElements: SVG stroke hit target
								<polyline
									key={key}
									fill="none"
									onClick={(event) => {
										event.stopPropagation();
										selectWire(from, to);
									}}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											selectWire(from, to);
										}
									}}
									points={points}
									role="button"
									stroke={color || "#22c55e"}
									strokeOpacity={hot ? 1 : 0.35}
									strokeWidth={hot ? 3 : 1.5}
									style={{ pointerEvents: "stroke", cursor: "pointer" }}
									tabIndex={0}
								/>
							);
						})}
					</svg>
				</div>
			</ZoomSurface>
			{diagram.steps?.length ? (
				<Stack
					spacing={1}
					className={expanded ? "mt-3 max-h-40 overflow-auto" : "mt-3"}
				>
					{diagram.steps.map((step, index) => (
						<button
							key={step.text}
							className={`rounded px-3 py-2 text-left text-sm ${
								index === activeStep
									? "bg-slate-800 text-white"
									: "text-slate-300"
							}`}
							onClick={() => selectStep(index)}
							type="button"
						>
							{index + 1}. {step.text}
						</button>
					))}
				</Stack>
			) : null}
		</BoardShell>
	);
}

function PreviewBoard({ previewUrl }: { previewUrl: string }) {
	const [expanded, setExpanded] = useState(false);
	const [natural, setNatural] = useState({ width: 800, height: 600 });
	const camera = useZoomCamera(natural.width, natural.height, expanded);

	useEffect(() => {
		if (!expanded) {
			return;
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setExpanded(false);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [expanded]);

	return (
		<BoardShell
			camera={camera}
			expanded={expanded}
			onToggleExpand={() => setExpanded((value) => !value)}
		>
			<ZoomSurface camera={camera} expanded={expanded}>
				<img
					alt="Breadboard preview"
					height={natural.height}
					onLoad={(event) => {
						const image = event.currentTarget;
						if (image.naturalWidth > 0 && image.naturalHeight > 0) {
							setNatural({
								width: image.naturalWidth,
								height: image.naturalHeight,
							});
						}
					}}
					src={previewUrl}
					width={natural.width}
				/>
			</ZoomSurface>
		</BoardShell>
	);
}

function BoardShell({
	camera,
	expanded,
	onToggleExpand,
	children,
}: {
	camera: ZoomCamera;
	expanded: boolean;
	onToggleExpand: () => void;
	children: ReactNode;
}) {
	return (
		<Paper
			className={
				expanded
					? "fixed inset-0 z-[1300] flex h-full flex-col overflow-hidden rounded-none p-4"
					: "overflow-hidden p-4"
			}
			elevation={expanded ? 8 : 1}
			sx={
				expanded
					? {
							paddingTop: "max(1rem, env(safe-area-inset-top))",
							paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
						}
					: undefined
			}
		>
			<Stack direction="row" spacing={0.5} className="mb-2 items-center">
				<Typography variant="subtitle1" className="min-w-0 flex-1">
					Breadboard
				</Typography>
				<Typography color="secondary" variant="caption">
					{camera.percent}%
				</Typography>
				<IconButton
					aria-label="Zoom out"
					color="secondary"
					onClick={() => camera.zoomBy(1 / 1.25)}
					size="small"
				>
					<ZoomOutIcon fill="currentColor" />
				</IconButton>
				<IconButton
					aria-label="Zoom in"
					color="secondary"
					onClick={() => camera.zoomBy(1.25)}
					size="small"
				>
					<ZoomInIcon fill="currentColor" />
				</IconButton>
				<IconButton
					aria-label="Fit to view"
					color="secondary"
					onClick={() => camera.fit()}
					size="small"
				>
					<FitScreenIcon fill="currentColor" />
				</IconButton>
				<IconButton
					aria-label={expanded ? "Exit full screen" : "Full screen"}
					color="secondary"
					onClick={onToggleExpand}
					size="small"
				>
					{expanded ? (
						<FullscreenExitIcon fill="currentColor" />
					) : (
						<FullscreenIcon fill="currentColor" />
					)}
				</IconButton>
			</Stack>
			{children}
		</Paper>
	);
}

function ZoomSurface({
	camera,
	expanded,
	children,
}: {
	camera: ZoomCamera;
	expanded: boolean;
	children: ReactNode;
}) {
	useEffect(() => {
		const el = camera.viewportRef.current;
		if (!el) {
			return;
		}
		const onWheel = (event: WheelEvent) => {
			if (!event.ctrlKey && !event.metaKey) {
				return;
			}
			event.preventDefault();
			const rect = el.getBoundingClientRect();
			camera.setView((current) =>
				zoomAt(
					current,
					event.deltaY < 0 ? 1.12 : 1 / 1.12,
					event.clientX - rect.left,
					event.clientY - rect.top,
				),
			);
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [camera]);

	return (
		<div
			aria-label="Breadboard canvas"
			className={`relative min-h-0 touch-none overflow-hidden bg-slate-950 ${
				expanded ? "flex-1" : "h-[320px] min-[900px]:h-[520px]"
			}`}
			onDoubleClick={() => camera.fit()}
			onPointerDown={camera.onPointerDown}
			onPointerMove={camera.onPointerMove}
			onPointerUp={camera.onPointerUp}
			onPointerCancel={camera.onPointerUp}
			ref={camera.viewportRef}
			role="application"
			style={{ cursor: "grab" }}
		>
			<div
				style={{
					transform: `translate(${camera.view.x}px, ${camera.view.y}px) scale(${camera.view.scale})`,
					transformOrigin: "0 0",
					width: "max-content",
				}}
			>
				{children}
			</div>
		</div>
	);
}

function useZoomCamera(
	contentWidth: number,
	contentHeight: number,
	resetKey: boolean,
	onBackgroundClick?: () => void,
): ZoomCamera {
	const viewportRef = useRef<HTMLDivElement>(null);
	const [view, setView] = useState<Viewport>({ scale: 1, x: 0, y: 0 });
	const viewRef = useRef(view);
	viewRef.current = view;
	const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
	const pointers = useRef(new Map<number, { x: number; y: number }>());
	const pinch = useRef<{
		distance: number;
		view: Viewport;
	} | null>(null);
	const click = useRef(onBackgroundClick);
	click.current = onBackgroundClick;

	const fit = useCallback(() => {
		const el = viewportRef.current;
		setView(
			fitContain(
				contentWidth,
				contentHeight,
				el?.clientWidth ?? 0,
				el?.clientHeight ?? 0,
			),
		);
	}, [contentWidth, contentHeight]);

	const fitTo = useCallback(
		(rect: { x: number; y: number; width: number; height: number }) => {
			const el = viewportRef.current;
			setView(fitRect(rect, el?.clientWidth ?? 0, el?.clientHeight ?? 0, 32));
		},
		[],
	);

	const zoomBy = useCallback((factor: number) => {
		const el = viewportRef.current;
		const w = el?.clientWidth ?? 0;
		const h = el?.clientHeight ?? 0;
		setView((current) => zoomAt(current, factor, w / 2, h / 2));
	}, []);

	useLayoutEffect(() => {
		void resetKey;
		fit();
	}, [fit, resetKey]);

	const onPointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			event.currentTarget.setPointerCapture(event.pointerId);
			pointers.current.set(event.pointerId, {
				x: event.clientX,
				y: event.clientY,
			});
			if (pointers.current.size === 1) {
				drag.current = { x: event.clientX, y: event.clientY, moved: false };
				pinch.current = null;
				event.currentTarget.style.cursor = "grabbing";
			} else {
				drag.current = null;
				const pts = [...pointers.current.values()];
				pinch.current = {
					distance: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1,
					view: viewRef.current,
				};
			}
		},
		[],
	);

	const onPointerMove = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (!pointers.current.has(event.pointerId)) {
				return;
			}
			pointers.current.set(event.pointerId, {
				x: event.clientX,
				y: event.clientY,
			});
			if (pointers.current.size === 2 && pinch.current) {
				const pts = [...pointers.current.values()];
				const distance =
					Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1;
				const rect = event.currentTarget.getBoundingClientRect();
				const originX = (pts[0].x + pts[1].x) / 2 - rect.left;
				const originY = (pts[0].y + pts[1].y) / 2 - rect.top;
				setView(
					zoomAt(
						pinch.current.view,
						distance / pinch.current.distance,
						originX,
						originY,
					),
				);
				return;
			}
			const active = drag.current;
			if (!active) {
				return;
			}
			const dx = event.clientX - active.x;
			const dy = event.clientY - active.y;
			if (Math.hypot(dx, dy) > 4) {
				active.moved = true;
			}
			active.x = event.clientX;
			active.y = event.clientY;
			setView((current) => panBy(current, dx, dy));
		},
		[],
	);

	const onPointerUp = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			pointers.current.delete(event.pointerId);
			if (pointers.current.size < 2) {
				pinch.current = null;
			}
			if (pointers.current.size === 0) {
				event.currentTarget.style.cursor = "grab";
				const active = drag.current;
				drag.current = null;
				if (active && !active.moved && event.target === event.currentTarget) {
					click.current?.();
				}
			}
		},
		[],
	);

	return useMemo(
		() => ({
			viewportRef,
			view,
			percent: Math.round(view.scale * 100),
			fit,
			fitTo,
			zoomBy,
			setView,
			onPointerDown,
			onPointerMove,
			onPointerUp,
		}),
		[view, fit, fitTo, zoomBy, onPointerDown, onPointerMove, onPointerUp],
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

function partHot(part: WokwiPart, highlight: string[]): boolean {
	if (isBreadboardType(part.type)) {
		return true;
	}
	return highlight.length === 0 || highlight.includes(part.id);
}

function wireHot(
	from: string,
	to: string,
	highlight: string[],
	wireKey: string | null,
	key: string,
): boolean {
	if (wireKey) {
		return wireKey === key;
	}
	if (highlight.length === 0) {
		return true;
	}
	return (
		highlight.includes(splitEndpoint(from).partId) ||
		highlight.includes(splitEndpoint(to).partId)
	);
}

function renderPart(
	diagram: WokwiDiagram,
	part: WokwiPart,
	hot: boolean,
	livePins: Record<number, 0 | 1> | undefined,
	boardModel: string | null | undefined,
	el: HTMLElement | undefined,
	ref: (el: HTMLElement | null) => void,
	onSelect: () => void,
) {
	const placement = snapPartPlacement(part, diagram, elementPins(el));
	const style: CSSProperties = {
		position: "absolute",
		left: placement.origin.x,
		top: placement.origin.y,
		transform: placement.rotate ? `rotate(${placement.rotate}deg)` : undefined,
		transformOrigin: "top left",
		opacity: hot ? 1 : 0.35,
		cursor: isBreadboardType(part.type) ? "default" : "pointer",
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
			<button
				key={part.id}
				onClick={(event) => {
					event.stopPropagation();
					onSelect();
				}}
				style={{ ...style, border: 0, background: "transparent", padding: 0 }}
				type="button"
			>
				<HeaderSvg
					hardware={part.attrs?.hardware ?? "raspberrypi"}
					boardModel={boardModel}
					livePins={livePins}
				/>
			</button>
		);
	}
	return (
		<button
			key={part.id}
			onClick={(event) => {
				event.stopPropagation();
				onSelect();
			}}
			style={{ ...style, border: 0, background: "transparent", padding: 0 }}
			type="button"
		>
			{createElement(part.type, {
				ref,
				id: part.id,
				...part.attrs,
			})}
		</button>
	);
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

function headerDefs(hardware: string, model?: string | null): HeaderPinDef[] {
	const id = isHardwareId(hardware) ? hardware : "raspberrypi";
	return headerPinsForBoard(id, model ?? undefined);
}

function headerFill(
	pin: HeaderPinDef,
	livePins?: Record<number, 0 | 1>,
): string {
	if (pin.type === "power") {
		return pin.name === "5V" ? "#ef4444" : "#fbbf24";
	}
	if (pin.type === "gnd") {
		return "#334155";
	}
	if (livePins?.[pin.physical] === 1) {
		return "#22c55e";
	}
	if (livePins?.[pin.physical] === 0) {
		return "#475569";
	}
	return "#e2e8f0";
}

function headerLabelFill(pin: HeaderPinDef): string {
	if (pin.type === "power") {
		return pin.name === "5V" ? "#fca5a5" : "#fcd34d";
	}
	if (pin.type === "gnd") {
		return "#94a3b8";
	}
	return "#cbd5e1";
}

function HeaderSvg({
	hardware,
	boardModel,
	livePins,
}: {
	hardware: string;
	boardModel?: string | null;
	livePins?: Record<number, 0 | 1>;
}) {
	const pins = headerDefs(hardware, boardModel);
	const { width, height } = headerSize(pins.length);
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
				const point = headerPinOffset(String(pin.physical), pins.length);
				if (!point) {
					return null;
				}
				const odd = pin.physical % 2 === 1;
				return (
					<g key={pin.physical}>
						<circle
							cx={point.x}
							cy={point.y}
							r={2.2}
							fill={headerFill(pin, livePins)}
							stroke={pin.type === "gnd" ? "#94a3b8" : "none"}
							strokeWidth={0.6}
						/>
						<text
							x={odd ? point.x - 5 : point.x + 5}
							y={point.y + 2.4}
							fill={headerLabelFill(pin)}
							fontSize={6}
							textAnchor={odd ? "end" : "start"}
						>
							{odd
								? `${pin.name} ${pin.physical}`
								: `${pin.physical} ${pin.name}`}
						</text>
					</g>
				);
			})}
		</svg>
	);
}

function collectPins(
	diagram: WokwiDiagram,
	refs: Map<string, HTMLElement>,
	boardModel?: string | null,
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
			const count = headerDefs(
				part.attrs?.hardware ?? "raspberrypi",
				boardModel,
			).length;
			for (let pin = 1; pin <= count; pin += 1) {
				addOffsetPin(pins, part, String(pin), origin, rotate, (name) =>
					headerPinOffset(name, count),
				);
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

function partSize(
	part: WokwiPart,
	boardModel?: string | null,
): { width: number; height: number } {
	if (isBreadboardType(part.type)) {
		return breadboardSize(part.type);
	}
	if (part.type === GPIO_COMPANION_HEADER_TYPE) {
		return headerSize(
			headerDefs(part.attrs?.hardware ?? "raspberrypi", boardModel).length,
		);
	}
	return { width: 80, height: 80 };
}

function partsRect(
	diagram: WokwiDiagram,
	ids: string[],
	refs: Map<string, HTMLElement>,
	boardModel?: string | null,
): { x: number; y: number; width: number; height: number } {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const part of diagram.parts) {
		if (!ids.includes(part.id)) {
			continue;
		}
		const origin = snapPartPlacement(
			part,
			diagram,
			elementPins(refs.get(part.id)),
		).origin;
		const size = partSize(part, boardModel);
		minX = Math.min(minX, origin.x);
		minY = Math.min(minY, origin.y);
		maxX = Math.max(maxX, origin.x + size.width);
		maxY = Math.max(maxY, origin.y + size.height);
	}
	if (!Number.isFinite(minX)) {
		return { x: 0, y: 0, width: 1, height: 1 };
	}
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function canvasBounds(
	diagram: WokwiDiagram,
	refs: Map<string, HTMLElement>,
	boardModel?: string | null,
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
		const size = partSize(part, boardModel);
		width = Math.max(width, origin.x + size.width + 24);
		height = Math.max(height, origin.y + size.height + 24);
	}
	return { width, height };
}
