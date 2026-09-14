import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
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
		<Box className="grid w-full min-w-0 max-w-full grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-1">
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
						className={`min-w-0 font-mono ${TONE_BG[tone] ?? ""}`}
						sx={{
							width: "100%",
							minWidth: 0,
							px: 0.5,
							py: 0.5,
							textTransform: "none",
							flexDirection: "column",
							lineHeight: 1.15,
						}}
						onClick={() => onSelect?.(pin)}
					>
						<span className="block w-full truncate text-xs leading-tight">
							{pin.name || `D${pin.physical}`}
						</span>
						<span className="block w-full truncate text-[10px] leading-tight opacity-80">
							{gpioPinStatusLabel(pin)}
						</span>
					</Button>
				);
			})}
		</Box>
	);
}
