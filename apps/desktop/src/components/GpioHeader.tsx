import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import type { GpioPinState } from "../api";

type GpioPinTone =
	| "power"
	| "gnd"
	| "reserved"
	| "unresolved"
	| "pwm"
	| "tone"
	| "high"
	| "low"
	| "idle";

const TONE_BG: Record<GpioPinTone, string> = {
	power: "bg-warning",
	gnd: "text-main",
	reserved: "bg-surface",
	unresolved: "bg-warning",
	pwm: "bg-info",
	tone: "bg-info",
	high: "bg-success",
	low: "bg-secondary",
	idle: "bg-surface",
};

function headerPinPairs(): Array<{ odd: number; even: number }> {
	const pairs: Array<{ odd: number; even: number }> = [];
	for (let physical = 1; physical <= 40; physical += 2) {
		pairs.push({ odd: physical, even: physical + 1 });
	}
	return pairs;
}

function pinByPhysical(
	pins: GpioPinState[],
	physical: number,
): GpioPinState | undefined {
	return pins.find((pin) => pin.physical === physical);
}

function canDriveGpio(pin: GpioPinState): boolean {
	return pin.type === "gpio" && !pin.reserved && !pin.unresolved;
}

function gpioPinTone(pin: GpioPinState): GpioPinTone {
	if (pin.type === "power") {
		return "power";
	}
	if (pin.type === "gnd") {
		return "gnd";
	}
	if (pin.reserved) {
		return "reserved";
	}
	if (pin.unresolved) {
		return "unresolved";
	}
	if (typeof pin.hz === "number") {
		return "tone";
	}
	if (typeof pin.analog === "number" || typeof pin.pwm === "number") {
		return "pwm";
	}
	if (pin.value === 1) {
		return "high";
	}
	if (pin.value === 0) {
		return "low";
	}
	return "idle";
}

function pinStatusLabel(pin: GpioPinState): string {
	if (pin.reserved) {
		return "Reserved";
	}
	if (pin.unresolved) {
		return "Unresolved";
	}
	if (typeof pin.hz === "number") {
		return `tone ${Math.round(pin.hz)} Hz`;
	}
	if (typeof pin.analog === "number") {
		return `PWM ${Math.round(pin.analog)}/255`;
	}
	if (typeof pin.pwm === "number") {
		return `PWM ${Math.round(pin.pwm)}%`;
	}
	const level =
		pin.value === 1 ? "high" : pin.value === 0 ? "low" : undefined;
	if (pin.dir === "in" || pin.dir === "out") {
		return level ? `${pin.dir} · ${level}` : pin.dir;
	}
	return level ?? "—";
}

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
	onToggle,
}: {
	pins: GpioPinState[];
	busy?: boolean;
	interactive?: boolean;
	onToggle?: (pin: GpioPinState) => void;
}) {
	const source = pins.length > 0 ? pins : placeholderPins();
	return (
		<Stack spacing={0.5} sx={{ fontFamily: "monospace" }}>
			{headerPinPairs().map((pair) => {
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
						sx={{ alignItems: "stretch" }}
					>
						<HeaderPin
							pin={odd}
							align="left"
							busy={busy}
							interactive={interactive}
							onToggle={onToggle}
						/>
						<HeaderPin
							pin={even}
							align="right"
							busy={busy}
							interactive={interactive}
							onToggle={onToggle}
						/>
					</Stack>
				);
			})}
		</Stack>
	);
}

function HeaderPin({
	pin,
	align,
	busy,
	interactive,
	onToggle,
}: {
	pin: GpioPinState;
	align: "left" | "right";
	busy: boolean;
	interactive: boolean;
	onToggle?: (pin: GpioPinState) => void;
}) {
	const driveable = interactive && canDriveGpio(pin);
	const tone = gpioPinTone(pin);
	const status = pinStatusLabel(pin);
	const label =
		pin.type === "gpio" && status !== "—"
			? `${pin.name || "GPIO"}  ${status}`
			: pin.name || "—";
	const content = (
		<Stack
			direction="row"
			spacing={1}
			sx={{
				width: "100%",
				minWidth: 0,
				alignItems: "center",
				justifyContent: align === "left" ? "flex-start" : "flex-end",
			}}
		>
			{align === "left" ? <PinDot tone={tone} /> : null}
			<Typography variant="caption" sx={{ flexShrink: 0 }}>
				{pin.physical}
			</Typography>
			<Typography variant="caption" noWrap sx={{ minWidth: 0 }}>
				{label}
			</Typography>
			{align === "right" ? <PinDot tone={tone} /> : null}
		</Stack>
	);
	if (!driveable) {
		return (
			<Box sx={{ minWidth: 0, flex: 1, px: 1, py: 0.5, opacity: 0.85 }}>
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
			onClick={() => onToggle?.(pin)}
			sx={{
				minWidth: 0,
				flex: 1,
				justifyContent: align === "left" ? "flex-start" : "flex-end",
			}}
		>
			{content}
		</Button>
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
