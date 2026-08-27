import type { SEOPluginOptions } from "frame-master-plugin-seo";

type SiteConfigType = {
	siteUrl: string;
	SEO: SEOPluginOptions;
	frameworkConfig: {
		routesExtensions?: string[];
	};
};

export default {
	siteUrl: "https://gpio-companion.com",
	SEO: {
		title: "gpio-companion dashboard",
		description: "Manage GPIO hardware linked to gpio-companion.",
		keywords: ["gpio-companion", "dashboard", "hardware"],
		author: "gpio-companion",
		canonical: "https://gpio-companion.com",
		robots: "noindex, nofollow",
		themeColor: "#020617",
		openGraph: {
			title: "gpio-companion dashboard",
			description: "Manage GPIO hardware linked to gpio-companion.",
			url: "https://gpio-companion.com",
			type: "website",
			site_name: "gpio-companion",
		},
		twitter: {
			card: "summary",
			title: "gpio-companion dashboard",
			description: "Manage GPIO hardware linked to gpio-companion.",
		},
		customTags: [],
	},
	frameworkConfig: {
		routesExtensions: [".tsx", ".jsx"],
	},
} satisfies SiteConfigType;
