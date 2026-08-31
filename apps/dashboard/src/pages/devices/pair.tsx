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
				can pair more than one board. After pairing, set WiFi from{" "}
				<a href="/devices/wifi">WiFi over Bluetooth</a> or Ethernet/TTY, then
				add a GitHub PAT on Keys.
			</Typography>
			<PairForm />
		</Stack>
	);
}
