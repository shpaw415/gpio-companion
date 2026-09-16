export type TranslateVars = Record<string, string | number>;

type NestedKey<T> = {
	[K in keyof T & string]: T[K] extends string
		? K
		: T[K] extends Record<string, unknown>
			? `${K}.${NestedKey<T[K]>}`
			: never;
}[keyof T & string];

export type MessageKey<T> = NestedKey<T>;

export type Translate<T> = (key: MessageKey<T>, vars?: TranslateVars) => string;
