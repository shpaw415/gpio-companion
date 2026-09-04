import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import { listNotifications, resolveNotification } from "../api";
import {
	CACHE_KEYS,
	useCachedQuery,
	useUserBoards,
} from "../hooks/useApiCache";
import DebugLog from "./DebugLog";
import { ListSkeleton } from "./skeletons";

export default function Requests() {
	const query = useCachedQuery(CACHE_KEYS.notifications, listNotifications);
	const { refetch: refetchBoards } = useUserBoards();
	const items = query.data?.items ?? [];
	const [error, setError] = useState("");
	const [busy, setBusy] = useState("");
	const loading = query.loading;

	async function act(uuid: string, action: "accept" | "reject") {
		setBusy(uuid);
		setError("");
		try {
			await resolveNotification(uuid, action);
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
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				Requests
			</Typography>
			{error || query.error ? (
				<Alert severity="error">{error || query.error}</Alert>
			) : null}
			{error || query.error ? (
				<DebugLog error={error || query.error} />
			) : null}
			{loading ? <ListSkeleton items={2} /> : null}
			{loading ? null : items.length === 0 ? (
				<Typography color="secondary">No pending transfer requests.</Typography>
			) : (
				items.map((item) => (
					<Paper key={item.uuid} sx={{ p: 2 }} elevation={1}>
						<Typography>{item.login || item.requesterEmail || item.uuid}</Typography>
						<Typography color="secondary">{item.uuid}</Typography>
						<Stack direction="row" spacing={1} sx={{ mt: 1 }}>
							<Button
								variant="contained"
								disabled={busy === item.uuid}
								onClick={() => void act(item.uuid, "accept")}
							>
								Accept
							</Button>
							<Button
								color="error"
								variant="text"
								disabled={busy === item.uuid}
								onClick={() => void act(item.uuid, "reject")}
							>
								Reject
							</Button>
						</Stack>
					</Paper>
				))
			)}
		</Stack>
	);
}
