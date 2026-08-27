import { GET as getPairing, POST as savePairing } from "@api/pair";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { giteaLoginFromEmail } from "gpio-companion";
import { type FormEvent, useEffect, useState } from "react";
import { useAuthSession } from "../hooks/useAuth.ts";

export default function PairForm() {
	const session = useAuthSession();
	const [deviceUrl, setDeviceUrl] = useState("");
	const [uuid, setUuid] = useState("");
	const [key, setKey] = useState("");
	const [giteaLogin, setGiteaLogin] = useState("");
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");
	const [paired, setPaired] = useState("");

	useEffect(() => {
		const userId = session.data?.id;
		if (!userId) {
			return;
		}
		void getPairing(userId).then((result) => {
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
		const userId = session.data?.id;
		if (!userId) {
			setError("sign in first");
			return;
		}
		setError("");
		setStatus("pairing…");
		const origin = deviceUrl.replace(/\/+$/, "");
		try {
			const claim = await fetch(`${origin}/v1/pairing/claim`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					uuid,
					key,
					userId,
					email: session.data?.email ?? "",
					giteaLogin,
				}),
			});
			if (!claim.ok) {
				throw new Error(`device ${claim.status}`);
			}
			const body = (await claim.json()) as { giteaLogin: string };
			await savePairing({
				userId,
				uuid,
				deviceUrl: origin,
				giteaLogin: body.giteaLogin || giteaLogin,
				email: session.data?.email ?? "",
				claimedAt: new Date().toISOString(),
			});
			setPaired(body.giteaLogin || giteaLogin);
			setStatus("paired");
			setKey("");
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
