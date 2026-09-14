import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import {
	type ArduinoLayoutSeat,
	arduinoProxyHeaderLayout,
	canDriveGpio,
	type GpioPinState,
	gpioPinStatusLabel,
	gpioPinTone,
	pinByPhysical,
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
	fqbn,
}: {
	pins: GpioPinState[];
	busy?: boolean;
	selected?: number;
	onSelect?: (pin: GpioPinState) => void;
	fqbn?: string;
}) {
	if (pins.length === 0) {
		return (
			<Typography color="secondary" variant="body2">
				Waiting for Arduino proxy pins.
			</Typography>
		);
	}
	const layout = arduinoProxyHeaderLayout(pins, fqbn);
	const rows = layout.left.map((left, index) => ({
		left,
		right: layout.right[index] ?? { kind: "gap" as const },
	}));
	return (
		<Stack spacing={0.5} className="w-full min-w-0 max-w-full font-mono">
			<Typography
				variant="caption"
				color="secondary"
				className="w-full text-center"
			>
				USB
			</Typography>
			{rows.map((row, index) => (
				<Stack
					key={index}
					direction="row"
					spacing={0.5}
					className="min-w-0 items-stretch"
				>
					<LayoutSeat
						seat={row.left}
						pins={pins}
						align="left"
						busy={busy}
						selected={selected}
						onSelect={onSelect}
					/>
					<Box
						aria-hidden
						className="w-3 shrink-0 self-stretch bg-surface"
						sx={{ borderRadius: 0.5 }}
					/>
					<LayoutSeat
						seat={row.right}
						pins={pins}
						align="right"
						busy={busy}
						selected={selected}
						onSelect={onSelect}
					/>
				</Stack>
			))}
			{layout.extra.length > 0 ? (
				<Stack spacing={0.5} className="pt-2">
					<Typography variant="caption" color="secondary">
						More pins
					</Typography>
					<Box className="grid w-full min-w-0 grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-1">
						{layout.extra.map((physical) => {
							const pin = pinByPhysical(pins, physical);
							if (!pin) {
								return null;
							}
							return (
								<PinButton
									key={physical}
									pin={pin}
									align="right"
									busy={busy}
									selected={selected === pin.physical}
									onSelect={onSelect}
								/>
							);
						})}
					</Box>
				</Stack>
			) : null}
		</Stack>
	);
}

function LayoutSeat({
	seat,
	pins,
	align,
	busy,
	selected,
	onSelect,
}: {
	seat: ArduinoLayoutSeat;
	pins: GpioPinState[];
	align: "left" | "right";
	busy: boolean;
	selected?: number;
	onSelect?: (pin: GpioPinState) => void;
}) {
	if (seat.kind === "gap") {
		return <Box className="min-w-0 flex-1" />;
	}
	if (seat.kind === "label") {
		return (
			<Typography
				variant="caption"
				color="secondary"
				noWrap
				className={
					align === "left"
						? "min-w-0 flex-1 px-1 py-0.5 text-right"
						: "min-w-0 flex-1 px-1 py-0.5 text-left"
				}
			>
				{seat.name}
			</Typography>
		);
	}
	const pin = pinByPhysical(pins, seat.physical);
	if (!pin) {
		return <Box className="min-w-0 flex-1" />;
	}
	return (
		<PinButton
			pin={pin}
			align={align}
			busy={busy}
			selected={selected === pin.physical}
			onSelect={onSelect}
		/>
	);
}

function PinButton({
	pin,
	align,
	busy,
	selected,
	onSelect,
}: {
	pin: GpioPinState;
	align: "left" | "right";
	busy: boolean;
	selected: boolean;
	onSelect?: (pin: GpioPinState) => void;
}) {
	const selectable = canDriveGpio(pin);
	const tone = gpioPinTone(pin);
	const status = gpioPinStatusLabel(pin);
	const content = (
		<Stack
			direction="row"
			spacing={0.5}
			className={
				align === "left"
					? "w-full min-w-0 items-center justify-end"
					: "w-full min-w-0 items-center"
			}
		>
			{align === "right" ? (
				<Box
					aria-hidden
					className={`size-2.5 shrink-0 rounded-full ${TONE_BG[tone] ?? "bg-surface"}`}
					sx={{ border: "1px solid rgba(var(--text-main), 0.24)" }}
				/>
			) : null}
			<Typography variant="caption" noWrap className="min-w-0">
				{pin.name || `D${pin.physical}`}
				{status !== "—" ? `  ${status}` : ""}
			</Typography>
			{align === "left" ? (
				<Box
					aria-hidden
					className={`size-2.5 shrink-0 rounded-full ${TONE_BG[tone] ?? "bg-surface"}`}
					sx={{ border: "1px solid rgba(var(--text-main), 0.24)" }}
				/>
			) : null}
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
			aria-label={`Pin ${pin.name || pin.physical} ${status}`}
			aria-pressed={selected}
			onClick={() => onSelect?.(pin)}
			className="min-w-0 flex-1"
			sx={{
				minWidth: 0,
				textTransform: "none",
				justifyContent: align === "left" ? "flex-end" : "flex-start",
				outline: selected
					? "2px solid rgb(var(--text-primary))"
					: "2px solid transparent",
			}}
		>
			{content}
		</Button>
	);
}
