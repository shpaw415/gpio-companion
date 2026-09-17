import type { Messages, Translate } from "gpio-companion-i18n";
import type { GpioPinState } from "../api";

export type CopyT = Translate<Messages>;

export function gpioPinStatusLabel(pin: GpioPinState, t: CopyT): string {
	if (pin.reserved) {
		return t("gpio.reserved");
	}
	if (pin.unresolved) {
		return t("gpio.unresolved");
	}
	if (pin.dir === "off") {
		return t("gpio.offDir");
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
	const high = pin.value === 1;
	const low = pin.value === 0;
	if (pin.dir === "in") {
		if (high) {
			return t("gpio.inHigh");
		}
		if (low) {
			return t("gpio.inLow");
		}
		return t("gpio.inDir");
	}
	if (pin.dir === "out") {
		if (high) {
			return t("gpio.outHigh");
		}
		if (low) {
			return t("gpio.outLow");
		}
		return t("gpio.outDir");
	}
	if (high) {
		return t("gpio.high");
	}
	if (low) {
		return t("gpio.low");
	}
	return "—";
}

export function consoleStatusLabel(status: string, t: CopyT): string {
	if (status === "reconnecting") {
		return t("gpio.reconnecting");
	}
	if (status === "connecting") {
		return t("gpio.connecting");
	}
	if (status === "live") {
		return t("gpio.liveChip");
	}
	return t("debug.idle");
}

export function verifyStatusLabel(status: string, t: CopyT): string {
	if (status === "pass") {
		return t("verify.pass");
	}
	if (status === "fail") {
		return t("verify.fail");
	}
	if (status === "needs-press") {
		return t("verify.press");
	}
	if (status === "unsafe") {
		return t("verify.unsafe");
	}
	return t("verify.unknown");
}
