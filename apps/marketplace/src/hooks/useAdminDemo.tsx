import { useCallback, useEffect, useState } from "react";

export const ADMIN_DEMO_STORAGE_KEY = "gpio-companion-marketplace-admin-demo";

/**
 * Demo admin flag until OpenAuthster + server-side requireAdmin land.
 * Production authorization must stay server-side; this only unlocks the UI.
 */
export function useAdminDemo(): {
	isAdmin: boolean;
	enable: () => void;
	disable: () => void;
} {
	const [isAdmin, setIsAdmin] = useState(false);

	useEffect(() => {
		try {
			setIsAdmin(
				window.localStorage.getItem(ADMIN_DEMO_STORAGE_KEY) === "1",
			);
		} catch {
			setIsAdmin(false);
		}
	}, []);

	const enable = useCallback(() => {
		setIsAdmin(true);
		try {
			window.localStorage.setItem(ADMIN_DEMO_STORAGE_KEY, "1");
		} catch {
			// In-memory flag still applies for this session.
		}
	}, []);

	const disable = useCallback(() => {
		setIsAdmin(false);
		try {
			window.localStorage.removeItem(ADMIN_DEMO_STORAGE_KEY);
		} catch {
			// In-memory flag still applies for this session.
		}
	}, []);

	return { isAdmin, enable, disable };
}
