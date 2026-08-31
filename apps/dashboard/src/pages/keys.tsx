import KeysForm from "@components/KeysForm";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";

export default function KeysPage() {
	return (
		<Stack spacing={3}>
			<Typography variant="h4" Element="h1">
				Keys
			</Typography>
			<Typography color="secondary">
				Use your GitHub account. Create a classic PAT with repo scope, then send
				username and token to the paired Pi through the dashboard
				(Ed25519-signed device API).
			</Typography>
			<KeysForm />
		</Stack>
	);
}
