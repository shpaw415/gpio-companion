import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import type { GpioPinState } from "../lib/api.ts";
import { useColors } from "../lib/color-mode.tsx";
import {
	type Messages,
	type Translate,
	useLocale,
	useT,
} from "../lib/locale.tsx";

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

const HEADER_PIN_PAIRS: Array<{ odd: number; even: number }> = Array.from(
	{ length: 20 },
	(_, index) => ({ odd: index * 2 + 1, even: index * 2 + 2 }),
);

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

function pinStatusLabel(pin: GpioPinState, t: Translate<Messages>): string {
	if (pin.reserved) {
		return t("gpio.reserved");
	}
	if (pin.unresolved) {
		return t("gpio.unresolved");
	}
	if (typeof pin.hz === "number") {
		return t("gpio.toneHz", { n: Math.round(pin.hz) });
	}
	if (typeof pin.analog === "number") {
		return t("gpio.pwmDuty", { n: Math.round(pin.analog) });
	}
	if (typeof pin.pwm === "number") {
		return t("gpio.pwmPct", { n: Math.round(pin.pwm) });
	}
	if (pin.dir === "in" && typeof pin.adc === "number") {
		return t("gpio.adc", { n: pin.adc });
	}
	if (pin.dir === "in") {
		return pin.value === 1
			? t("gpio.inHigh")
			: pin.value === 0
				? t("gpio.inLow")
				: pin.dir;
	}
	if (pin.dir === "out") {
		return pin.value === 1
			? t("gpio.outHigh")
			: pin.value === 0
				? t("gpio.outLow")
				: pin.dir;
	}
	if (pin.value === 1) {
		return t("gpio.high");
	}
	if (pin.value === 0) {
		return t("gpio.low");
	}
	return "—";
}

function pinStatusKey(pin: GpioPinState): string {
	return `${pin.physical}:${pin.dir ?? ""}:${pin.value ?? ""}:${pin.analog ?? ""}:${pin.hz ?? ""}:${pin.pwm ?? ""}:${pin.adc ?? ""}:${pin.name}:${pin.type}`;
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
	selected,
	onSelect,
}: {
	pins: GpioPinState[];
	busy?: boolean;
	interactive?: boolean;
	selected?: number;
	onSelect?: (pin: GpioPinState) => void;
}) {
	const colors = useColors();
	const { locale } = useLocale();
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
			{HEADER_PIN_PAIRS.map((pair) => {
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
							selected={selected === odd.physical}
							dot={toneColor[gpioPinTone(odd)]}
							ring={colors.primary}
							locale={locale}
							onSelect={onSelect}
						/>
						<HeaderPin
							pin={even}
							align="right"
							busy={busy}
							interactive={interactive}
							selected={selected === even.physical}
							dot={toneColor[gpioPinTone(even)]}
							ring={colors.primary}
							locale={locale}
							onSelect={onSelect}
						/>
					</View>
				);
			})}
		</View>
	);
}

const HeaderPin = memo(function HeaderPin({
	pin,
	align,
	busy,
	interactive,
	selected,
	dot,
	ring,
	onSelect,
}: {
	pin: GpioPinState;
	align: "left" | "right";
	busy: boolean;
	interactive: boolean;
	selected: boolean;
	dot: string;
	ring: string;
	locale: string;
	onSelect?: (pin: GpioPinState) => void;
}) {
	const colors = useColors();
	const t = useT();
	const selectable = interactive && canDriveGpio(pin) && !busy;
	const status = pinStatusLabel(pin, t);
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
				borderWidth: 2,
				borderColor: selected ? ring : "transparent",
				borderRadius: 6,
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
	if (!selectable) {
		return (
			<View style={{ flex: 1, minWidth: 0, opacity: 0.85 }}>{content}</View>
		);
	}
	return (
		<Pressable
			style={{ flex: 1, minWidth: 0 }}
			onPress={() => onSelect?.(pin)}
			accessibilityLabel={t("gpio.pin", { n: pin.physical, name: label })}
			accessibilityState={{ selected }}
		>
			{content}
		</Pressable>
	);
}, headerPinEqual);

function headerPinEqual(
	prev: {
		pin: GpioPinState;
		busy: boolean;
		interactive: boolean;
		selected: boolean;
		dot: string;
		ring: string;
		locale: string;
		onSelect?: (pin: GpioPinState) => void;
	},
	next: {
		pin: GpioPinState;
		busy: boolean;
		interactive: boolean;
		selected: boolean;
		dot: string;
		ring: string;
		locale: string;
		onSelect?: (pin: GpioPinState) => void;
	},
) {
	return (
		prev.busy === next.busy &&
		prev.interactive === next.interactive &&
		prev.selected === next.selected &&
		prev.dot === next.dot &&
		prev.ring === next.ring &&
		prev.locale === next.locale &&
		prev.onSelect === next.onSelect &&
		pinStatusKey(prev.pin) === pinStatusKey(next.pin)
	);
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
