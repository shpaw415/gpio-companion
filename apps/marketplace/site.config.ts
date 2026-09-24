import type { SEOPluginOptions } from "frame-master-plugin-seo";

type SiteConfigType = {
	siteUrl: string;
	SEO: SEOPluginOptions;
	frameworkConfig: {
		routesExtensions?: string[];
	};
};

export default {
	siteUrl: "https://marketplace.gpio-companion.com",
	SEO: {
		title: "gpio-companion workbench market",
		description:
			"Hardware kits for an on-device agent, visual circuit guidance, GitHub projects, GPIO control, and Arduino in C.",
		keywords: ["gpio-companion", "GPIO", "Arduino", "electronics kit"],
		author: "gpio-companion",
		canonical: "https://marketplace.gpio-companion.com",
		robots: "index, follow",
		themeColor: "#006b61",
		openGraph: {
			title: "gpio-companion workbench market",
			description:
				"Hardware kits for an on-device agent, visual circuit guidance, GitHub projects, GPIO control, and Arduino in C.",
			url: "https://marketplace.gpio-companion.com",
			type: "website",
			image: "https://marketplace.gpio-companion.com/static/favicon.ico",
			site_name: "gpio-companion",
		},
		twitter: {
			card: "summary",
			site: "@gpio-companion",
			creator: "@gpio-companion",
			title: "gpio-companion workbench market",
			description:
				"Hardware kits for an on-device agent, visual circuit guidance, GitHub projects, GPIO control, and Arduino in C.",
			image: "https://marketplace.gpio-companion.com/static/favicon.ico",
		},
		customTags: [],
	},
	frameworkConfig: {
		routesExtensions: [".tsx", ".jsx"],
	},
} satisfies SiteConfigType;
