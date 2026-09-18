export const en = {
	brand: {
		name: "gpio-companion",
		marketplace: "Workbench market",
		tagline: "Electronics kits built for an agent-powered bench.",
	},
	nav: {
		label: "Marketplace navigation",
		home: "Home",
		kits: "Kits",
		cart: "Cart",
		orders: "Orders",
		openMenu: "Open navigation",
		closeMenu: "Close navigation",
	},
	action: {
		addToCart: "Add to cart",
		viewKit: "View kit",
		browseKits: "Browse kits",
		goHome: "Back to the workbench",
		remove: "Remove",
		clearCart: "Clear cart",
		retry: "Try again",
		previous: "Previous",
		next: "Next",
	},
	product: {
		new: "New",
		featured: "Bench pick",
		inStock: "In stock",
		lowStock: "Low stock",
		outOfStock: "Out of stock",
		quantity: "Quantity",
		decreaseQuantity: "Decrease quantity",
		increaseQuantity: "Increase quantity",
	},
	cart: {
		title: "Your parts tray",
		count: "{count} items in cart",
		emptyTitle: "Your parts tray is empty",
		emptyBody: "Choose a kit and we will keep its parts together here.",
	},
	orders: {
		title: "Orders",
		emptyTitle: "No orders yet",
		emptyBody: "Your completed kit orders will appear here.",
	},
	footer: {
		shop: "Shop",
		support: "Support",
		kits: "All kits",
		orders: "Orders",
		shipping: "Shipping",
		contact: "Contact",
		note: "Designed for real benches, not display shelves.",
		rights: "All rights reserved.",
	},
	language: {
		label: "Language",
		english: "English",
		french: "French",
	},
	theme: {
		light: "Use light theme",
		dark: "Use dark theme",
	},
	state: {
		loading: "Preparing the workbench",
		loadingBody: "Checking parts and connections...",
		notFoundCode: "OPEN CIRCUIT / 404",
		notFoundTitle: "This trace leads nowhere",
		notFoundBody:
			"The page may have moved, or this connection was never soldered.",
	},
	admin: {
		restrictedTitle: "Workbench access required",
		restrictedBody:
			"Sign in with an administrator account to use these controls.",
		tabsLabel: "Administration sections",
		rowsPerPage: "Rows per page:",
		displayedRows: "{from}-{to} of {count}",
	},
} as const;

type WidenStrings<T> = {
	[K in keyof T]: T[K] extends string
		? string
		: T[K] extends Record<string, unknown>
			? WidenStrings<T[K]>
			: T[K];
};

export type Messages = WidenStrings<typeof en>;
