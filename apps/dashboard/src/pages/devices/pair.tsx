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
				Connect over Bluetooth to load Device URL, pairing UUID, and key from
				the Pi. If Web Bluetooth is unavailable, the dashboard signs a command
				to paste in LightBlue or nRF Connect. Console printout still works. You
				can pair more than one board. After claim (or anytime from Devices
				overview), start T3 Code to get a one-click app.t3.codes URL. Then set
				WiFi from <a href="/devices/wifi">WiFi over Bluetooth</a> or
				Ethernet/TTY, and connect GitHub on Keys.
			</Typography>
			<PairForm />
		</Stack>
	);
}
