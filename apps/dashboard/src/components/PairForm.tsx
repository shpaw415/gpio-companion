import { POST as claimPairing, GET as getPairing } from "@api/pair";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { giteaLoginFromEmail } from "gpio-companion";
import { type FormEvent, useEffect, useState } from "react";
import { useAuthSession } from "../hooks/useAuth.ts";

export default function PairForm({
	onComplete,
}: {
	onComplete?: (deviceUrl: string) => void;
}) {
	const session = useAuthSession();
	const [deviceUrl, setDeviceUrl] = useState("");
	const [uuid, setUuid] = useState("");
	const [key, setKey] = useState("");
	const [giteaLogin, setGiteaLogin] = useState("");
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");
	const [paired, setPaired] = useState("");

	useEffect(() => {
		if (!session.data?.id) {
			return;
		}
		void getPairing().then((result) => {
			if (result.paired) {
				setPaired(result.device.giteaLogin);
				setDeviceUrl(result.device.deviceUrl);
			}
		});
		if (!giteaLogin && session.data?.email) {
			setGiteaLogin(giteaLoginFromEmail(session.data.email));
		}
	}, [session.data?.id, session.data?.email, giteaLogin]);

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		if (!session.data?.id) {
			setError("sign in first");
			return;
		}
		setError("");
		setStatus("pairing…");
		try {
			const body = await claimPairing({
				deviceUrl,
				uuid,
				key,
				giteaLogin,
			});
			setPaired(body.giteaLogin);
			setDeviceUrl(body.deviceUrl);
			setStatus("paired");
			setKey("");
			onComplete?.(body.deviceUrl);
		} catch (caught) {
			setStatus("");
			setError(caught instanceof Error ? caught.message : "pair failed");
		}
	}

	if (!session.data?.id && !session.data?.email) {
		return (
			<Typography color="secondary">
				<Button href="/login" variant="text">
					Sign in
				</Button>{" "}
				to pair a board.
			</Typography>
		);
	}

	return (
		<Paper className="max-w-xl p-6" elevation={1}>
			<form onSubmit={onSubmit}>
				<Stack spacing={2}>
					{paired ? (
						<Alert severity="success">Paired as Gitea account {paired}</Alert>
					) : null}
					<TextField
						label="Device URL"
						placeholder="https://pi.example.com:4150"
						value={deviceUrl}
						onChange={(event) => setDeviceUrl(event.target.value)}
						className="w-full"
					/>
					<TextField
						label="Pairing UUID"
						value={uuid}
						onChange={(event) => setUuid(event.target.value)}
						className="w-full"
					/>
					<TextField
						label="Pairing key"
						type="password"
						value={key}
						onChange={(event) => setKey(event.target.value)}
						className="w-full"
					/>
					<TextField
						label="Gitea account"
						value={giteaLogin}
						onChange={(event) => setGiteaLogin(event.target.value)}
						className="w-full"
					/>
					<Button type="submit" variant="contained">
						Pair hardware
					</Button>
					{status ? <Typography color="secondary">{status}</Typography> : null}
					{error ? <Alert severity="error">{error}</Alert> : null}
				</Stack>
			</form>
		</Paper>
	);
}
