import PairForm from "@components/PairForm";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";

export default function PairPage() {
	return (
		<Stack spacing={3}>
			<Typography variant="h4" Element="h1">
				Pair hardware
			</Typography>
			<Typography color="secondary">
				Enter the pairing UUID and key printed at Pi first-setup. This binds
				your dashboard user to that board. Create a Gitea account first, then
				set username and token on the Pi via Keys (device API).
			</Typography>
			<PairForm />
		</Stack>
	);
}
