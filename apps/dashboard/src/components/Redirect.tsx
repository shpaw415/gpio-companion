import Box from "@shpaw415/mui-lite/Box";
import Typography from "@shpaw415/mui-lite/Typography";
import { navigate } from "@next/client";
import { useEffect } from "react";

export default function Redirect({ to }: { to: string }) {
	useEffect(() => {
		navigate(to);
	}, [to]);

	return (
		<Box className="py-16 text-center">
			<Typography Element="a" href={to} color="secondary">
				Redirecting… go to the {to} section.
			</Typography>
		</Box>
	);
}