import KeysForm from "@components/KeysForm";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";

export default function KeysPage() {
	const giteaUrl = process.env.PUBLIC_GITEA_URL || process.env.GITEA_URL || "";
	return (
		<Stack spacing={3}>
			<Typography variant="h4" Element="h1">
				Keys
			</Typography>
			<Typography color="secondary">
				Create a Gitea account first, then send username and token to the paired
				Pi through the dashboard (Ed25519-signed device API).
			</Typography>
			{giteaUrl ? (
				<Button href={giteaUrl} variant="outlined">
					Open Gitea and register
				</Button>
			) : (
				<Typography color="secondary">
					Set PUBLIC_GITEA_URL on the dashboard to link registration.
				</Typography>
			)}
			<KeysForm giteaRegisterUrl={giteaUrl} />
		</Stack>
	);
}
