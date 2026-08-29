import { POST as decideNote, GET as listNotes } from "@api/notifications";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import { List, ListItem, ListItemText } from "@shpaw415/mui-lite/List";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import { useAuthSession } from "../hooks/useAuth.ts";

type Item = {
	uuid: string;
	requesterEmail: string;
	giteaLogin: string;
	createdAt: string;
};

export default function NotificationCenter() {
	const session = useAuthSession();
	const [items, setItems] = useState<Item[]>([]);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	useEffect(() => {
		if (!session.data?.id) {
			return;
		}
		void listNotes().then((result) => {
			setItems(result.items);
		});
	}, [session.data?.id]);

	if (!session.data?.id) {
		return (
			<Typography color="secondary">
				<Button href="/login" variant="text">
					Sign in
				</Button>{" "}
				to see pairing requests.
			</Typography>
		);
	}

	return (
		<Paper className="max-w-xl p-6" elevation={1}>
			<Stack spacing={2}>
				<Typography>
					Incoming pairing transfers wait here until you accept or reject.
					Accept moves the board and revokes T3 Code for the previous session.
				</Typography>
				{items.length === 0 ? (
					<Typography color="secondary">
						No pending pairing requests.
					</Typography>
				) : (
					<List>
						{items.map((item) => (
							<ListItem key={item.uuid}>
								<ListItemText
									primary={`${item.requesterEmail || item.giteaLogin} wants ${item.uuid}`}
									secondary={item.createdAt}
								/>
								<Button
									variant="contained"
									onClick={() => {
										void decideNote({ uuid: item.uuid, action: "accept" })
											.then(async () => {
												setMessage("transferred");
												setItems((await listNotes()).items);
											})
											.catch((caught: unknown) => {
												setError(
													caught instanceof Error
														? caught.message
														: "accept failed",
												);
											});
									}}
								>
									Accept
								</Button>
								<Button
									variant="outlined"
									onClick={() => {
										void decideNote({ uuid: item.uuid, action: "reject" })
											.then(async () => {
												setMessage("rejected");
												setItems((await listNotes()).items);
											})
											.catch((caught: unknown) => {
												setError(
													caught instanceof Error
														? caught.message
														: "reject failed",
												);
											});
									}}
								>
									Reject
								</Button>
							</ListItem>
						))}
					</List>
				)}
				{message ? <Alert severity="success">{message}</Alert> : null}
				{error ? <Alert severity="error">{error}</Alert> : null}
			</Stack>
		</Paper>
	);
}
