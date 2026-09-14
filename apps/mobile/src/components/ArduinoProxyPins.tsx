import { Pressable, Text, View } from "react-native";
import type { GpioPinState } from "../lib/api.ts";
import { useColors } from "../lib/color-mode.tsx";

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
	const colors = useColors();
	const toneColor: Record<string, string> = {
		reserved: colors.border,
		pwm: colors.primary,
		tone: colors.primary,
		high: colors.success,
		low: colors.muted,
		idle: colors.border,
	};
	if (pins.length === 0) {
		return (
			<Text style={{ color: colors.muted }}>Waiting for Arduino proxy pins.</Text>
		);
	}
	return (
		<View
			style={{
				flexDirection: "row",
				flexWrap: "wrap",
				gap: 6,
				width: "100%",
			}}
		>
			{pins.map((pin) => {
				const tone = gpioPinTone(pin);
				const active = selected === pin.physical;
				const locked = busy || !canDriveGpio(pin);
				return (
					<Pressable
						key={pin.physical}
						disabled={locked}
						onPress={() => onSelect?.(pin)}
						style={{
							flexGrow: 1,
							flexBasis: 68,
							maxWidth: "100%",
							minWidth: 0,
							opacity: locked ? 0.5 : 1,
							borderWidth: active ? 2 : 1,
							borderColor: active ? colors.primary : toneColor[tone] ?? colors.border,
							backgroundColor: active ? colors.chipBg : colors.surface,
							borderRadius: 8,
							paddingVertical: 6,
							paddingHorizontal: 4,
							alignItems: "center",
						}}
					>
						<Text
							numberOfLines={1}
							style={{
								color: colors.text,
								fontFamily: "monospace",
								fontSize: 12,
								width: "100%",
								textAlign: "center",
							}}
						>
							{pin.name || `D${pin.physical}`}
						</Text>
						<Text
							numberOfLines={1}
							style={{
								color: colors.muted,
								fontSize: 10,
								width: "100%",
								textAlign: "center",
							}}
						>
							{pinStatus(pin)}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}
