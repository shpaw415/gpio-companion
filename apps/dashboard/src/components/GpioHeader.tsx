import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	canDriveGpio,
	type GpioPinState,
	type GpioPinTone,
	gpioPinTone,
	headerPinPairs,
	pinByPhysical,
} from "gpio-companion";

const TONE_BG: Record<GpioPinTone, string> = {
	power: "bg-warning",
	gnd: "text-main",
	reserved: "bg-surface",
	unresolved: "bg-warning",
	pwm: "bg-info",
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
	onToggle,
}: {
	pins: GpioPinState[];
	busy?: boolean;
	interactive?: boolean;
	onToggle?: (pin: GpioPinState) => void;
}) {
	const source = pins.length > 0 ? pins : placeholderPins();
	return (
		<Stack spacing={0.5} className="font-mono">
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
						className="items-stretch"
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
	const label = pin.name || "—";
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
	if (!driveable) {
		return (
			<Box className="min-w-0 flex-1 px-1 py-0.5" sx={{ opacity: 0.85 }}>
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
			className="min-w-0 flex-1"
			sx={{ justifyContent: align === "left" ? "flex-start" : "flex-end" }}
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
