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
				Connect the gpio-companion GitHub App. Boards pull a live installation
				token when they push — you do not create a PAT.
			</Typography>
			<KeysForm />
		</Stack>
	);
}