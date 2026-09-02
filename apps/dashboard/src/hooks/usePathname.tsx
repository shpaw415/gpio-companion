import { createContext, type ReactNode, useContext } from "react";

const PathnameCtx = createContext<string | null>(null);

export function PathnameProvider({
	pathname,
	children,
}: {
	pathname: string;
	children: ReactNode;
}) {
	return (
		<PathnameCtx.Provider value={pathname}>{children}</PathnameCtx.Provider>
	);
}

export function usePathname(): string {
	const ctx = useContext(PathnameCtx);
	if (ctx != null) {
		return ctx;
	}
	if (typeof window === "undefined") {
		return "/";
	}
	return window.location.pathname;
}
