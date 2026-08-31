import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";

export default function NotFound() {
	return (
		<Paper className="mx-auto mt-16 max-w-md p-8" elevation={1}>
			<Stack spacing={2} alignItems="center">
				<Typography variant="h4">Page not found</Typography>
				<Typography color="secondary" align="center">
					The page you're looking for doesn't exist or has been moved.
				</Typography>
				<Button href="/project" variant="contained">
					Back to home
				</Button>
			</Stack>
		</Paper>
	);
}
