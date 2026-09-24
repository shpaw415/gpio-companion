import type { ReactNode } from "react";
import { CartProvider } from "../hooks/useCart.tsx";
import { ColorModeProvider } from "../hooks/useColorMode.tsx";
import { LocaleProvider } from "../hooks/useLocale.tsx";
import { SessionProvider } from "../hooks/useSession.tsx";

export default function MarketplaceProviders({
	children,
}: {
	children: ReactNode;
}) {
	return (
		<LocaleProvider>
			<ColorModeProvider>
				<SessionProvider>
					<CartProvider>{children}</CartProvider>
				</SessionProvider>
			</ColorModeProvider>
		</LocaleProvider>
	);
}
