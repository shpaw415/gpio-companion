export interface StarterKitSeed {
	product: {
		slug: string;
		sku: string;
		nameEn: string;
		nameFr: string;
		descriptionEn: string;
		descriptionFr: string;
		priceCents: null;
		status: "draft";
	};
	contents: readonly string[];
	images: readonly [];
	inventory: null;
}

export function getStarterKitSeed(): StarterKitSeed {
	return {
		product: {
			slug: "gpio-companion-starter-kit",
			sku: "GPIO-COMPANION-STARTER-KIT",
			nameEn: "gpio-companion starter kit",
			nameFr: "Kit de demarrage gpio-companion",
			descriptionEn:
				"A configured gpio-companion board with its power supply, a breadboard, one LED, one 220 ohm to 1 kohm resistor, and two jumper wires.",
			descriptionFr:
				"Une carte gpio-companion configuree avec son alimentation, une plaque d'essai, une LED, une resistance de 220 ohms a 1 kohm et deux fils de connexion.",
			priceCents: null,
			status: "draft",
		},
		contents: [
			"Configured gpio-companion board and power supply",
			"Breadboard",
			"LED",
			"220 ohm to 1 kohm resistor",
			"Two jumper wires",
		],
		images: [],
		inventory: null,
	};
}
