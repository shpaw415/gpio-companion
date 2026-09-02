import {
	RouterHost,
	type router,
} from "frame-master-plugin-apply-react/router";
import { SSRPropsProvider } from "frame-master-plugin-cloudflare-pages-dynamic-ssr/client/context";
import type { PropsData } from "frame-master-plugin-cloudflare-pages-dynamic-ssr/provider/utils";
import {
	type JSX,
	StrictMode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { createClient, type PublicSession } from "./auth.ts";
import T3Frame from "./components/T3Frame.tsx";
import { AuthCtx, AuthSessionCtx } from "./hooks/useAuth.ts";
import { ColorModeProvider } from "./hooks/useColorMode.tsx";
import { PathnameProvider } from "./hooks/usePathname.tsx";
import { T3SessionProvider } from "./hooks/useT3Session.tsx";
import {
	identityToPublicSession,
	resolveUserIdentity,
} from "./lib/auth/identity.ts";
import {
	attachAccessCookieSync,
	installAuthAwareFetch,
	syncAccessCookie,
} from "./lib/auth/refresh.ts";

export default function ClientWrapper({ children }: { children: JSX.Element }) {
	const routeChangePromiseRef = useRef<
		ReturnType<typeof Promise.withResolvers<Array<PropsData> | null>>
	>(Promise.withResolvers<Array<PropsData> | null>());
	const resetRouteChangePromise = useCallback(
		(ref: typeof routeChangePromiseRef) => {
			ref.current.resolve?.(null);
			ref.current = Promise.withResolvers<Array<PropsData> | null>();
		},
		[],
	);
	const [pathname, setPathname] = useState(window.location.pathname);
	const [devKey, setDevKey] = useState(0);
	const matched = useRef<ReturnType<typeof router.match>>(null);

	return (
		<StrictMode>
			<SSRPropsProvider
				pathname={pathname}
				afterFetchCallback={() =>
					resetRouteChangePromise(routeChangePromiseRef)
				}
				devKey={devKey}
				fetchCallback={(_, dynamicEndpoints) => {
					const res = Boolean(
						matched.current?.name &&
							dynamicEndpoints.includes(matched.current.name),
					);
					if (!res) resetRouteChangePromise(routeChangePromiseRef);
					return res;
				}}
			>
				<PathnameProvider pathname={pathname}>
					<ColorModeProvider>
						<AuthProvider>
							<T3SessionProvider>
								<RouterHost
									onRouteChange={async (match) => {
										matched.current = match;
										setPathname(match.pathname);
										if (process.env.NODE_ENV === "development") {
											setDevKey((prev) => prev + 1);
										}
										await routeChangePromiseRef.current.promise;
									}}
								>
									{children}
								</RouterHost>
								<T3Frame />
							</T3SessionProvider>
						</AuthProvider>
					</ColorModeProvider>
				</PathnameProvider>
			</SSRPropsProvider>
		</StrictMode>
	);
}

function AuthProvider({ children }: { children: JSX.Element }) {
	const auth = useRef(createClient());
	const [session, setSession] = useState<PublicSession | null>(null);

	useEffect(() => {
		const client = auth.current;
		attachAccessCookieSync(client);
		const uninstallFetch = installAuthAwareFetch(client);
		let cancelled = false;
		client
			.init()
			.then(async (ready) => {
				if (cancelled) {
					return;
				}
				syncAccessCookie(ready);
				const identity = await resolveUserIdentity(ready);
				if (cancelled) {
					return;
				}
				if (!identity.id && !identity.email) {
					setSession(null);
					return;
				}
				setSession(identityToPublicSession(identity));
			})
			.catch(() => {
				if (!cancelled) {
					setSession(null);
				}
			});
		return () => {
			cancelled = true;
			uninstallFetch();
		};
	}, []);

	return (
		<AuthCtx.Provider value={auth.current}>
			<AuthSessionCtx.Provider value={session}>
				{children}
			</AuthSessionCtx.Provider>
		</AuthCtx.Provider>
	);
}
