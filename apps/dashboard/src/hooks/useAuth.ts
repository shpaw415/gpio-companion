import { type Context, createContext, useContext } from "react";
import type { createClient, PublicSession } from "../auth.ts";

declare global {
	var AuthCtx: Context<ReturnType<typeof createClient> | null>;
	var AuthSessionCtx: Context<PublicSession | null>;
}

globalThis.AuthCtx ??= createContext<ReturnType<typeof createClient> | null>(
	null,
);
globalThis.AuthSessionCtx ??= createContext<PublicSession | null>(null);

export function useAuth() {
	return useContext(globalThis.AuthCtx);
}

export function useAuthSession() {
	return {
		data: useContext(globalThis.AuthSessionCtx),
	};
}

const _AuthCtx = globalThis.AuthCtx;
const _AuthSessionCtx = globalThis.AuthSessionCtx;

export { _AuthCtx as AuthCtx, _AuthSessionCtx as AuthSessionCtx };
