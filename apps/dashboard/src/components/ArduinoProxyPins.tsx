import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	canDriveGpio,
	type GpioPinState,
	gpioPinStatusLabel,
	gpioPinTone,
} from "gpio-companion";

const TONE_BG: Record<string, string> = {
	reserved: "bg-surface",
	pwm: "bg-info",
	tone: "bg-info",
	high: "bg-success",
	low: "bg-secondary",
	idle: "bg-surface",
};

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
		<Stack direction="row" spacing={0.5} className="flex-wrap">
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
						className={`min-w-14 font-mono ${TONE_BG[tone] ?? ""}`}
						onClick={() => onSelect?.(pin)}
					>
						<span className="block text-xs">
							{pin.name || `D${pin.physical}`}
						</span>
						<span className="block text-[10px] opacity-80">
							{gpioPinStatusLabel(pin)}
						</span>
					</Button>
				);
			})}
		</Stack>
	);
}
