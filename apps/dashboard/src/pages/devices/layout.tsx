import Box from "@shpaw415/mui-lite/Box";
import { usePathname } from "../../hooks/usePathname.tsx";
import { isT3Path } from "../../lib/t3-url.ts";

export default function DevicesLayout({
	children,
}: {
	children: React.JSX.Element;
}) {
	const pathname = usePathname();
	const onT3 = isT3Path(pathname);

	return (
		<Box
			sx={{
				minWidth: 0,
				width: "100%",
				...(onT3
					? {
							display: "flex",
							flexDirection: "column",
							flex: 1,
							minHeight: 0,
							overflow: "hidden",
						}
					: undefined),
			}}
		>
			<Box
				sx={
					onT3
						? {
								flex: 1,
								minHeight: 0,
								display: "flex",
								flexDirection: "column",
								overflow: "hidden",
							}
						: undefined
				}
			>
				{children}
			</Box>
		</Box>
	);
}
