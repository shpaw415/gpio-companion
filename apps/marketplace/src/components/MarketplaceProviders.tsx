import type { ReactNode } from "react";
import { CartProvider } from "../hooks/useCart.tsx";
import { ColorModeProvider } from "../hooks/useColorMode.tsx";
import { LocaleProvider } from "../hooks/useLocale.tsx";

export default function MarketplaceProviders({
	children,
}: {
	children: ReactNode;
}) {
	return (
		<LocaleProvider>
			<ColorModeProvider>
				<CartProvider>{children}</CartProvider>
			</ColorModeProvider>
		</LocaleProvider>
	);
}
