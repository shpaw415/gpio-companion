import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import {
	listNotifications,
	type PendingRequest,
	resolveNotification,
} from "../api";
import DebugLog from "./DebugLog";
import { ListSkeleton } from "./skeletons";

export default function Requests() {
	const [items, setItems] = useState<PendingRequest[]>([]);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState("");
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		void listNotifications()
			.then((result) => setItems(result.items))
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "load failed");
			})
			.finally(() => setLoading(false));
	}, []);

	async function act(uuid: string, action: "accept" | "reject") {
		setBusy(uuid);
		setError("");
		try {
			await resolveNotification(uuid, action);
			setItems((current) => current.filter((item) => item.uuid !== uuid));
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
			{error ? <Alert severity="error">{error}</Alert> : null}
			{error ? <DebugLog error={error} /> : null}
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
