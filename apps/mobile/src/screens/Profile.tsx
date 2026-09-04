import { useState } from "react";
import { getCredits, grantCredits } from "../lib/api.ts";
import { CACHE_KEYS, useCachedQuery } from "../lib/api-cache.tsx";
import { useAuth } from "../lib/auth.tsx";
import {
	Body,
	ErrorText,
	Muted,
	Paper,
	PrimaryButton,
	Screen,
	Skeleton,
	TextButton,
	Title,
} from "../components/ui.tsx";

export default function Profile() {
	const auth = useAuth();
	const token = auth.token;
	const creditsQuery = useCachedQuery(CACHE_KEYS.credits, () => {
		if (!token) {
			return Promise.reject(new Error("sign in first"));
		}
		return getCredits(token);
	});
	const credits = creditsQuery.data ?? null;
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	return (
		<Screen>
			<Title>Profile</Title>
			<ErrorText>{error || creditsQuery.error}</ErrorText>
			<Paper>
				<Body>Account</Body>
				<Body>{auth.session?.name || "Signed in"}</Body>
				<Muted>{auth.session?.email}</Muted>
				<Muted>Role: {auth.session?.role || "user"}</Muted>
				<TextButton label="Sign out" onPress={() => void auth.logout()} />
			</Paper>
			<Paper>
				<Body>Credits</Body>
				{creditsQuery.loading ? (
					<Skeleton height={24} />
				) : (
					<Muted>
						{credits
							? `$${credits.usd.toFixed(2)} (${credits.micros} µUSD)`
							: "No credits yet"}
					</Muted>
				)}
				<PrimaryButton
					label={busy ? "Adding…" : "Add $1.00 (stub)"}
					disabled={busy || !token}
					onPress={() => {
						if (!token) {
							return;
						}
						setBusy(true);
						void grantCredits(token, 1)
							.then((next) => creditsQuery.setData(next))
							.catch((caught) => {
								setError(caught instanceof Error ? caught.message : "grant failed");
							})
							.finally(() => setBusy(false));
					}}
				/>
			</Paper>
		</Screen>
	);
}
