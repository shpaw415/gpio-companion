import CssBaseline from "@shpaw415/mui-lite/CssBaseline";
import { APP_DATA } from "./common.ts";
import { ColorModeProvider } from "./hooks/useColorMode.tsx";

export default function RenderShell({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link
					rel="preconnect"
					href="https://fonts.gstatic.com"
					crossOrigin="anonymous"
				/>
				<link
					rel="stylesheet"
					href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap"
				/>
				<link rel="icon" href="/static/favicon.ico" />
				<link rel="stylesheet" href="/static/style.css" />
				<title>{APP_DATA.projectName}</title>
			</head>
			<body id="root">
				<ColorModeProvider>
					<CssBaseline />
					{children}
				</ColorModeProvider>
			</body>
		</html>
	);
}
