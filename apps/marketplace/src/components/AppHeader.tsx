import AppBar from "@shpaw415/mui-lite/AppBar";
import Badge from "@shpaw415/mui-lite/Badge";
import Button from "@shpaw415/mui-lite/Button";
import IconButton from "@shpaw415/mui-lite/IconButton";
import Paper from "@shpaw415/mui-lite/Paper";
import Toolbar from "@shpaw415/mui-lite/Toolbar";
import type { ReactNode } from "react";
import { useState } from "react";
import { useCart } from "../hooks/useCart.tsx";
import { useT } from "../hooks/useLocale.tsx";
import { useSession } from "../hooks/useSession.tsx";
import BrandMark from "./BrandMark.tsx";
import ColorModeButton from "./ColorModeButton.tsx";
import { CartIcon, CloseIcon, MenuIcon } from "./icons.tsx";
import LanguageSwitcher from "./LanguageSwitcher.tsx";

export type AppHeaderProps = {
	activePath?: string;
	accountSlot?: ReactNode;
	sessionSlot?: ReactNode;
	cartCount?: number;
};

export default function AppHeader({
	activePath = "",
	accountSlot,
	sessionSlot,
	cartCount,
}: AppHeaderProps) {
	const t = useT();
	const cart = useCart();
	const { session } = useSession();
	const [open, setOpen] = useState(false);
	const count = cartCount ?? cart.count;
	const links = [
		{ href: "/", label: t("nav.home") },
		{ href: "/kits", label: t("nav.kits") },
		{ href: "/orders", label: t("nav.orders") },
		...(session?.role === "admin"
			? [{ href: "/admin", label: t("nav.admin") }]
			: []),
	];

	return (
		<AppBar position="sticky" color="inherit" className="market-app-bar">
			<Toolbar className="market-header-inner">
				<a href="/" className="market-wordmark" aria-label={t("brand.name")}>
					<BrandMark />
					<span>{t("brand.name")}</span>
					<small>{t("brand.marketplace")}</small>
				</a>
				<nav className="market-desktop-nav" aria-label={t("nav.label")}>
					{links.map((link) => (
						<a
							key={link.href}
							href={link.href}
							aria-current={activePath === link.href ? "page" : undefined}
						>
							{link.label}
						</a>
					))}
				</nav>
				<div className="market-header-actions">
					<LanguageSwitcher compact />
					<ColorModeButton />
					<a
						className="market-cart-link"
						href="/cart"
						aria-label={t("cart.count", { count })}
					>
						<Badge
							badgeContent={count}
							invisible={count === 0}
							color="secondary"
						>
							<CartIcon />
						</Badge>
					</a>
					{session?.id ? null : (
						<Button href="/login" variant="text" size="small">
							{t("nav.signIn")}
						</Button>
					)}
					{sessionSlot}
					{accountSlot}
					<IconButton
						className="market-menu-button"
						aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
						aria-expanded={open}
						onClick={() => setOpen((value) => !value)}
					>
						{open ? <CloseIcon /> : <MenuIcon />}
					</IconButton>
				</div>
			</Toolbar>
			{open ? (
				<Paper className="market-mobile-nav" square elevation={2}>
					<nav aria-label={t("nav.label")}>
						{links.map((link) => (
							<Button
								key={link.href}
								href={link.href}
								variant={activePath === link.href ? "contained" : "text"}
								fullWidth
							>
								{link.label}
							</Button>
						))}
						<div className="market-mobile-tools">
							<LanguageSwitcher />
							<ColorModeButton />
						</div>
					</nav>
				</Paper>
			) : null}
		</AppBar>
	);
}
