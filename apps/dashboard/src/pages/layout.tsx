import AppBar from "@shpaw415/mui-lite/AppBar";
import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import Toolbar from "@shpaw415/mui-lite/Toolbar";
import Typography from "@shpaw415/mui-lite/Typography";

const nav = [
	{ href: "/", label: "Hardware" },
	{ href: "/projects", label: "Projects" },
	{ href: "/pair", label: "Pair" },
	{ href: "/keys", label: "Keys" },
	{ href: "/login", label: "Sign in" },
];

export default function Layout({ children }: { children: React.JSX.Element }) {
	return (
		<Box sx={{ minHeight: "100dvh", bgcolor: "bg-main" }}>
			<AppBar position="sticky" color="default">
				<Toolbar className="gap-2">
					<Typography variant="h6" Element="a" href="/" sx={{ flexGrow: 1 }}>
						gpio-companion
					</Typography>
					{nav.map((item) => (
						<Button
							key={item.href}
							href={item.href}
							variant="text"
							size="small"
						>
							{item.label}
						</Button>
					))}
				</Toolbar>
			</AppBar>
			<Box className="mx-auto max-w-5xl px-4 py-8">{children}</Box>
		</Box>
	);
}
