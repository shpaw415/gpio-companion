import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";

export default function HomePage() {
	return (
		<Stack spacing={3}>
			<Typography variant="h4" Element="h1">
				Hardware
			</Typography>
			<Typography color="secondary">
				Manage GPIO boards linked to gpio-companion. Pairing and T3 Code access
				are handled here. Create a Gitea account first, then set credentials on
				the Pi via Keys.
			</Typography>
			<Paper className="p-6" elevation={1}>
				<Typography variant="overline" color="secondary">
					no devices yet
				</Typography>
				<Typography className="mt-2">
					After first-setup on a Pi, the cloudflared replica publishes T3 Code
					through the custom endpoint. Pair that board from the Pair page.
				</Typography>
			</Paper>
			<Stack direction="row" spacing={2} className="flex-wrap">
				<Button href="/projects" variant="contained">
					Projects
				</Button>
				<Button href="/keys" variant="outlined">
					Keys
				</Button>
				<Button href="/pair" variant="outlined">
					Pair hardware
				</Button>
			</Stack>
		</Stack>
	);
}
