import { useState } from "react";
import {
	ErrorText,
	Muted,
	Paper,
	Screen,
	Skeleton,
	TextButton,
} from "../components/ui.tsx";
import { listNotifications, resolveNotification } from "../lib/api.ts";
import {
	CACHE_KEYS,
	useCachedQuery,
	useUserBoards,
} from "../lib/api-cache.tsx";
import { useAuth } from "../lib/auth.tsx";
import { translateError, useT } from "../lib/locale.tsx";

export default function Requests() {
	const auth = useAuth();
	const t = useT();
	const token = auth.token;
	const query = useCachedQuery(CACHE_KEYS.notifications, () => {
		if (!token) {
			return Promise.reject(new Error("sign in first"));
		}
		return listNotifications(token);
	});
	const { refetch: refetchBoards } = useUserBoards();
	const items = query.data?.items ?? [];
	const [error, setError] = useState("");
	const [busy, setBusy] = useState("");

	async function act(uuid: string, action: "accept" | "reject") {
		if (!token) {
			return;
		}
		setBusy(uuid);
		setError("");
		try {
			await resolveNotification(token, uuid, action);
			query.setData((current) => ({
				items: (current?.items ?? []).filter((item) => item.uuid !== uuid),
			}));
			void refetchBoards({ force: true }).catch(() => undefined);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "request failed");
		} finally {
			setBusy("");
		}
	}

	return (
		<Screen>
			<ErrorText>{translateError(t, error || query.error || "")}</ErrorText>
			{query.loading ? (
				<>
					<Skeleton />
					<Skeleton />
				</>
			) : items.length === 0 ? (
				<Muted>{t("requests.empty")}</Muted>
			) : (
				items.map((item) => (
					<Paper key={item.uuid}>
						<Muted>{item.requesterEmail || item.login || item.uuid}</Muted>
						<Muted>{item.uuid}</Muted>
						<TextButton
							label={
								busy === item.uuid
									? t("requests.working")
									: t("requests.accept")
							}
							disabled={busy === item.uuid}
							onPress={() => void act(item.uuid, "accept")}
						/>
						<TextButton
							danger
							label={t("requests.reject")}
							disabled={busy === item.uuid}
							onPress={() => void act(item.uuid, "reject")}
						/>
					</Paper>
				))
			)}
		</Screen>
	);
}
