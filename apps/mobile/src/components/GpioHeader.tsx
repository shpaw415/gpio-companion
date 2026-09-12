import { Pressable, Text, View } from "react-native";
import type { GpioPinState } from "../lib/api.ts";
import { useColors } from "../lib/color-mode.tsx";

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
	const colors = useColors();
	const source = pins.length > 0 ? pins : placeholderPins();
	const toneColor: Record<GpioPinTone, string> = {
		power: colors.warning,
		gnd: colors.text,
		reserved: colors.border,
		unresolved: colors.warning,
		pwm: colors.primary,
		tone: colors.primary,
		high: colors.success,
		low: colors.muted,
		idle: colors.border,
	};
	return (
		<View style={{ gap: 4 }}>
			{headerPinPairs().map((pair) => {
				const odd = pinByPhysical(source, pair.odd);
				const even = pinByPhysical(source, pair.even);
				if (!odd || !even) {
					return null;
				}
				return (
					<View
						key={pair.odd}
						style={{ flexDirection: "row", gap: 8, alignItems: "stretch" }}
					>
						<HeaderPin
							pin={odd}
							align="left"
							busy={busy}
							interactive={interactive}
							dot={toneColor[gpioPinTone(odd)]}
							onToggle={onToggle}
						/>
						<HeaderPin
							pin={even}
							align="right"
							busy={busy}
							interactive={interactive}
							dot={toneColor[gpioPinTone(even)]}
							onToggle={onToggle}
						/>
					</View>
				);
			})}
		</View>
	);
}

function HeaderPin({
	pin,
	align,
	busy,
	interactive,
	dot,
	onToggle,
}: {
	pin: GpioPinState;
	align: "left" | "right";
	busy: boolean;
	interactive: boolean;
	dot: string;
	onToggle?: (pin: GpioPinState) => void;
}) {
	const colors = useColors();
	const driveable = interactive && canDriveGpio(pin) && !busy;
	const status = pinStatusLabel(pin);
	const label =
		pin.type === "gpio" && status !== "—"
			? `${pin.name || "GPIO"}  ${status}`
			: pin.name || "—";
	const content = (
		<View
			style={{
				flex: 1,
				minWidth: 0,
				flexDirection: "row",
				alignItems: "center",
				justifyContent: align === "left" ? "flex-start" : "flex-end",
				gap: 6,
				paddingVertical: 2,
			}}
		>
			{align === "left" ? <PinDot color={dot} /> : null}
			<Text style={{ color: colors.text, fontVariant: ["tabular-nums"] }}>
				{pin.physical}
			</Text>
			<Text
				numberOfLines={1}
				style={{ color: colors.muted, flexShrink: 1, minWidth: 0 }}
			>
				{label}
			</Text>
			{align === "right" ? <PinDot color={dot} /> : null}
		</View>
	);
	if (!driveable) {
		return (
			<View style={{ flex: 1, minWidth: 0, opacity: 0.85 }}>{content}</View>
		);
	}
	return (
		<Pressable
			style={{ flex: 1, minWidth: 0 }}
			onPress={() => onToggle?.(pin)}
			accessibilityLabel={`Pin ${pin.physical} ${label}`}
		>
			{content}
		</Pressable>
	);
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

function PinDot({ color }: { color: string }) {
	return (
		<View
			style={{
				width: 10,
				height: 10,
				borderRadius: 5,
				backgroundColor: color,
			}}
		/>
	);
}
