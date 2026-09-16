import type { MessageKey, Translate, TranslateVars } from "./types.ts";

export function interpolate(template: string, vars?: TranslateVars): string {
	if (!vars) {
		return template;
	}
	return template.replace(/\{(\w+)\}/g, (match, name: string) => {
		const value = vars[name];
		return value === undefined ? match : String(value);
	});
}

export function lookup(messages: unknown, key: string): string | undefined {
	let current: unknown = messages;
	for (const part of key.split(".")) {
		if (!current || typeof current !== "object") {
			return undefined;
		}
		current = (current as Record<string, unknown>)[part];
	}
	return typeof current === "string" ? current : undefined;
}

export function createTranslator<T>(messages: T, fallback?: T): Translate<T> {
	return (key: MessageKey<T>, vars?: TranslateVars) => {
		const path = String(key);
		const value =
			lookup(messages, path) ?? (fallback ? lookup(fallback, path) : undefined);
		if (value === undefined) {
			return path;
		}
		return interpolate(value, vars);
	};
}
