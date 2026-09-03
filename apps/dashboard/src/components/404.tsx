import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";

export default function NotFound() {
	return (
		<Paper className="mx-auto mt-8 w-full max-w-md p-6 min-[900px]:mt-16 min-[900px]:p-8" elevation={1}>
			<Stack spacing={2} alignItems="center">
				<Typography variant="h5" className="min-[900px]:text-inherit">
					Page not found
				</Typography>
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
