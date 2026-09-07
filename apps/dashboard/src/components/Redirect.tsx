import { navigate } from "@next/client";
import Box from "@shpaw415/mui-lite/Box";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect } from "react";
import { withSearch } from "../lib/dashboard-mode.ts";

export default function Redirect({
	to,
	preserveSearch = false,
}: {
	to: string;
	preserveSearch?: boolean;
}) {
	const dest =
		preserveSearch && typeof window !== "undefined"
			? withSearch(to, window.location.search)
			: to;

	useEffect(() => {
		navigate(dest);
	}, [dest]);

	return (
		<Box className="py-16 text-center">
			<Typography Element="a" href={dest} color="secondary">
				Redirecting… go to the {dest} section.
			</Typography>
		</Box>
	);
}
