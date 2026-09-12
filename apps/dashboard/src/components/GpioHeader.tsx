import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	canDriveGpio,
	type GpioPinState,
	type GpioPinTone,
	gpioPinStatusKey,
	gpioPinStatusLabel,
	gpioPinTone,
	HEADER_PIN_PAIRS,
	pinByPhysical,
} from "gpio-companion";
import { memo } from "react";

const TONE_BG: Record<GpioPinTone, string> = {
	power: "bg-warning",
	gnd: "bg-main",
	reserved: "bg-surface",
	unresolved: "bg-warning",
	pwm: "bg-info",
	tone: "bg-info",
	high: "bg-success",
	low: "bg-secondary",
	idle: "bg-surface",
};

function placeholderPins(): GpioPinState[] {
	return Array.from({ length: 40 }, (_, index) => ({
		physical: index + 1,
		name: "",
		type: "gpio",
	}));
}

export default function GpioHeader({
	pins,
	busy = false,
	interactive = false,
	selected,
	onSelect,
}: {
	pins: GpioPinState[];
	busy?: boolean;
	interactive?: boolean;
	selected?: number;
	onSelect?: (pin: GpioPinState) => void;
}) {
	const source = pins.length > 0 ? pins : placeholderPins();
	return (
		<Stack spacing={0.5} className="font-mono">
			{HEADER_PIN_PAIRS.map((pair) => {
				const odd = pinByPhysical(source, pair.odd);
				const even = pinByPhysical(source, pair.even);
				if (!odd || !even) {
					return null;
				}
				return (
					<Stack
						key={pair.odd}
						direction="row"
						spacing={1}
						className="items-stretch"
					>
						<HeaderPin
							pin={odd}
							align="left"
							busy={busy}
							interactive={interactive}
							selected={selected === odd.physical}
							onSelect={onSelect}
						/>
						<HeaderPin
							pin={even}
							align="right"
							busy={busy}
							interactive={interactive}
							selected={selected === even.physical}
							onSelect={onSelect}
						/>
					</Stack>
				);
			})}
		</Stack>
	);
}

const HeaderPin = memo(function HeaderPin({
	pin,
	align,
	busy,
	interactive,
	selected,
	onSelect,
}: {
	pin: GpioPinState;
	align: "left" | "right";
	busy: boolean;
	interactive: boolean;
	selected: boolean;
	onSelect?: (pin: GpioPinState) => void;
}) {
	const selectable = interactive && canDriveGpio(pin);
	const tone = gpioPinTone(pin);
	const status = gpioPinStatusLabel(pin);
	const label =
		pin.type === "gpio" && status !== "—"
			? `${pin.name || "GPIO"}  ${status}`
			: pin.name || "—";
	const content = (
		<Stack
			direction="row"
			spacing={1}
			className={
				align === "left"
					? "w-full min-w-0 items-center"
					: "w-full min-w-0 items-center justify-end"
			}
		>
			{align === "left" ? <PinDot tone={tone} /> : null}
			<Typography variant="caption" className="shrink-0 tabular-nums">
				{pin.physical}
			</Typography>
			<Typography variant="caption" noWrap className="min-w-0">
				{label}
			</Typography>
			{align === "right" ? <PinDot tone={tone} /> : null}
		</Stack>
	);
	if (!selectable) {
		return (
			<Box
				className="min-w-0 flex-1 px-1 py-0.5"
				sx={{
					opacity: 0.85,
					borderRadius: 1,
					outline: selected
						? "2px solid rgb(var(--text-primary))"
						: "2px solid transparent",
				}}
			>
				{content}
			</Box>
		);
	}
	return (
		<Button
			type="button"
			variant="text"
			size="small"
			disabled={busy}
			aria-label={`Pin ${pin.physical} ${label} ${tone}`}
			aria-pressed={selected}
			onClick={() => onSelect?.(pin)}
			className="min-w-0 flex-1"
			sx={{
				justifyContent: align === "left" ? "flex-start" : "flex-end",
				outline: selected
					? "2px solid rgb(var(--text-primary))"
					: "2px solid transparent",
			}}
		>
			{content}
		</Button>
	);
}, headerPinEqual);

function headerPinEqual(
	prev: {
		pin: GpioPinState;
		busy: boolean;
		interactive: boolean;
		selected: boolean;
		onSelect?: (pin: GpioPinState) => void;
	},
	next: {
		pin: GpioPinState;
		busy: boolean;
		interactive: boolean;
		selected: boolean;
		onSelect?: (pin: GpioPinState) => void;
	},
) {
	return (
		prev.busy === next.busy &&
		prev.interactive === next.interactive &&
		prev.selected === next.selected &&
		prev.onSelect === next.onSelect &&
		gpioPinStatusKey(prev.pin) === gpioPinStatusKey(next.pin) &&
		prev.pin.name === next.pin.name &&
		prev.pin.type === next.pin.type
	);
}

function PinDot({ tone }: { tone: GpioPinTone }) {
	return (
		<Box
			aria-hidden
			sx={{
				width: 10,
				height: 10,
				borderRadius: "50%",
				flexShrink: 0,
				bgcolor: TONE_BG[tone],
				border: "1px solid rgba(var(--text-main), 0.24)",
			}}
		/>
	);
}
