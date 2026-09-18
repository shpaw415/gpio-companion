import type { SEOPluginOptions } from "frame-master-plugin-seo";

type SiteConfigType = {
	/** Base URL of the website. Required for sitemap index generation. Example: https://example.com */
	siteUrl: string;
	SEO: SEOPluginOptions;
	frameworkConfig: {
		/**
		 * @default [".tsx", ".jsx"]
		 */
		routesExtensions?: string[];
	}
};

export default {
	siteUrl: "https://myawesomesite.com",
	SEO: {
		title: "My Awesome Site",
		description: "This is a flawlessly optimized Frame-Master site.",
		keywords: ["Frame-Master", "SEO", "Optimization", "Plugin"],
		author: "Jane Doe",
		canonical: "https://myawesomesite.com",
		robots: "index, follow",
		themeColor: "#ffffff",
		openGraph: {
			title: "My Awesome Site",
			description: "This is a flawlessly optimized Frame-Master site.",
			url: "https://myawesomesite.com",
			type: "website",
			image: "https://myawesomesite.com/og-image.jpg",
			site_name: "My Awesome Site",
		},
		twitter: {
			card: "summary_large_image",
			site: "@myawesomesite",
			creator: "@janedoe",
			title: "My Awesome Site",
			description: "This is a flawlessly optimized Frame-Master site.",
			image: "https://myawesomesite.com/twitter-image.jpg",
		},
		customTags: [
			'<meta name="google-site-verification" content="your-verification-code">',
		],
	},
	frameworkConfig: {
		routesExtensions: [".tsx", ".jsx"],
	}
} satisfies SiteConfigType;
