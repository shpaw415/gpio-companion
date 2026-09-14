import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import Typography from "@shpaw415/mui-lite/Typography";
import type { GpioPinState } from "../api";

const TONE_BG: Record<string, string> = {
	reserved: "bg-surface",
	pwm: "bg-info",
	tone: "bg-info",
	high: "bg-success",
	low: "bg-secondary",
	idle: "bg-surface",
};

function canDriveGpio(pin: GpioPinState): boolean {
	return pin.type === "gpio" && !pin.reserved && !pin.unresolved;
}

function gpioPinTone(pin: GpioPinState): string {
	if (pin.reserved) {
		return "reserved";
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

function pinStatus(pin: GpioPinState): string {
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
	const level = pin.value === 1 ? "high" : pin.value === 0 ? "low" : undefined;
	if (pin.dir === "in" || pin.dir === "out") {
		return level ? `${pin.dir} · ${level}` : pin.dir;
	}
	return level ?? "—";
}

export default function ArduinoProxyPins({
	pins,
	busy = false,
	selected,
	onSelect,
}: {
	pins: GpioPinState[];
	busy?: boolean;
	selected?: number;
	onSelect?: (pin: GpioPinState) => void;
}) {
	if (pins.length === 0) {
		return (
			<Typography color="secondary" variant="body2">
				Waiting for Arduino proxy pins.
			</Typography>
		);
	}
	return (
		<Box
			sx={{
				display: "grid",
				width: "100%",
				minWidth: 0,
				maxWidth: "100%",
				gridTemplateColumns: "repeat(auto-fill, minmax(4.25rem, 1fr))",
				gap: 1,
			}}
		>
			{pins.map((pin) => {
				const tone = gpioPinTone(pin);
				const active = selected === pin.physical;
				return (
					<Button
						key={pin.physical}
						type="button"
						size="small"
						variant={active ? "contained" : "outlined"}
						disabled={busy || !canDriveGpio(pin)}
						className={TONE_BG[tone] ?? ""}
						sx={{
							width: "100%",
							minWidth: 0,
							px: 0.5,
							py: 0.5,
							textTransform: "none",
							flexDirection: "column",
							lineHeight: 1.15,
							fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
						}}
						onClick={() => onSelect?.(pin)}
					>
						<Typography noWrap variant="caption" sx={{ width: "100%" }}>
							{pin.name || `D${pin.physical}`}
						</Typography>
						<Typography
							noWrap
							variant="caption"
							sx={{ width: "100%", opacity: 0.8, fontSize: "0.625rem" }}
						>
							{pinStatus(pin)}
						</Typography>
					</Button>
				);
			})}
		</Box>
	);
}
