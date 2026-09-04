import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { listDevices } from "./api.ts";
import { useAuth } from "./auth.tsx";
import { QueryCache } from "./query-cache.ts";

export const USER_DEVICES_KEY = "user-devices";

export type UserDevice = {
	uuid: string;
	deviceUrl: string;
	login: string;
	label?: string;
};

export type UserDeviceList = {
	paired: boolean;
	devices: UserDevice[];
};

type DeviceCacheValue = {
	cache: QueryCache;
	version: number;
};

const DeviceCacheCtx = createContext<DeviceCacheValue | null>(null);

export function DeviceCacheProvider({ children }: { children: ReactNode }) {
	const auth = useAuth();
	const cacheRef = useRef(new QueryCache());
	const cache = cacheRef.current;
	const [version, setVersion] = useState(0);

	useEffect(() => cache.subscribe(() => setVersion((n) => n + 1)), [cache]);

	useEffect(() => {
		if (!auth.token) {
			cache.clear();
			return;
		}
		const token = auth.token;
		void cache
			.get(USER_DEVICES_KEY, () => listDevices(token))
			.catch(() => undefined);
	}, [auth.token, cache]);

	const value = useMemo(() => ({ cache, version }), [cache, version]);
	return (
		<DeviceCacheCtx.Provider value={value}>{children}</DeviceCacheCtx.Provider>
	);
}

export function useDeviceCache(): DeviceCacheValue {
	const ctx = useContext(DeviceCacheCtx);
	if (!ctx) {
		throw new Error("useDeviceCache requires DeviceCacheProvider");
	}
	return ctx;
}

export function useUserDevices() {
	const auth = useAuth();
	const { cache, version } = useDeviceCache();
	void version;
	const token = auth.token;
	const hit = cache.peek<UserDeviceList>(USER_DEVICES_KEY);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(!hit.hit);

	const fetcher = useCallback(() => {
		if (!token) {
			return Promise.reject(new Error("sign in first"));
		}
		return listDevices(token);
	}, [token]);

	useEffect(() => {
		let cancelled = false;
		if (!token) {
			setLoading(false);
			return;
		}
		if (hit.hit) {
			setLoading(false);
			return;
		}
		setLoading(true);
		void cache
			.get(USER_DEVICES_KEY, fetcher)
			.then(() => {
				if (!cancelled) {
					setError("");
				}
			})
			.catch((caught) => {
				if (!cancelled) {
					setError(caught instanceof Error ? caught.message : "load failed");
				}
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [cache, fetcher, hit.hit, token]);

	const setData = useCallback(
		(
			value:
				| UserDeviceList
				| ((prev: UserDeviceList | undefined) => UserDeviceList),
		) => {
			const prev = cache.peek<UserDeviceList>(USER_DEVICES_KEY);
			const next =
				typeof value === "function"
					? value(prev.hit ? prev.value : undefined)
					: value;
			cache.set(USER_DEVICES_KEY, next);
		},
		[cache],
	);

	const refetch = useCallback(
		(options?: { force?: boolean }) =>
			cache.get(USER_DEVICES_KEY, fetcher, options?.force === true),
		[cache, fetcher],
	);

	const removeDevice = useCallback(
		(uuid: string) => {
			setData((current) => {
				const devices = (current?.devices ?? []).filter(
					(device) => device.uuid !== uuid,
				);
				return { paired: devices.length > 0, devices };
			});
		},
		[setData],
	);

	return {
		devices: hit.hit ? hit.value.devices : [],
		error,
		loading,
		setData,
		refetch,
		removeDevice,
	};
}
