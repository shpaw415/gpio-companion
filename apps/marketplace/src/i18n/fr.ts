import type { Messages } from "./en.ts";

export const fr = {
	brand: {
		name: "gpio-companion",
		marketplace: "Marché de l’atelier",
		tagline: "Des kits électroniques conçus pour un atelier assisté par agent.",
	},
	nav: {
		label: "Navigation de la boutique",
		home: "Accueil",
		kits: "Kits",
		cart: "Panier",
		orders: "Commandes",
		openMenu: "Ouvrir la navigation",
		closeMenu: "Fermer la navigation",
	},
	action: {
		addToCart: "Ajouter au panier",
		viewKit: "Voir le kit",
		browseKits: "Découvrir les kits",
		goHome: "Retour à l’atelier",
		remove: "Retirer",
		clearCart: "Vider le panier",
		retry: "Réessayer",
		previous: "Précédent",
		next: "Suivant",
	},
	product: {
		new: "Nouveau",
		featured: "Choix de l’atelier",
		inStock: "En stock",
		lowStock: "Stock faible",
		outOfStock: "Rupture de stock",
		quantity: "Quantité",
		decreaseQuantity: "Diminuer la quantité",
		increaseQuantity: "Augmenter la quantité",
	},
	cart: {
		title: "Votre bac à composants",
		count: "{count} articles dans le panier",
		emptyTitle: "Votre bac à composants est vide",
		emptyBody:
			"Choisissez un kit et nous garderons ses composants regroupés ici.",
	},
	orders: {
		title: "Commandes",
		emptyTitle: "Aucune commande",
		emptyBody: "Vos commandes de kits terminées apparaîtront ici.",
	},
	footer: {
		shop: "Boutique",
		support: "Assistance",
		kits: "Tous les kits",
		orders: "Commandes",
		shipping: "Livraison",
		contact: "Contact",
		note: "Conçu pour de vrais ateliers, pas pour les vitrines.",
		rights: "Tous droits réservés.",
	},
	language: {
		label: "Langue",
		english: "Anglais",
		french: "Français",
	},
	theme: {
		light: "Utiliser le thème clair",
		dark: "Utiliser le thème sombre",
	},
	state: {
		loading: "Préparation de l’atelier",
		loadingBody: "Vérification des composants et des connexions...",
		notFoundCode: "CIRCUIT OUVERT / 404",
		notFoundTitle: "Cette piste ne mène nulle part",
		notFoundBody:
			"La page a peut-être été déplacée, ou cette connexion n’a jamais été soudée.",
	},
	admin: {
		restrictedTitle: "Accès à l’atelier requis",
		restrictedBody:
			"Connectez-vous avec un compte administrateur pour utiliser ces commandes.",
		tabsLabel: "Sections d’administration",
		rowsPerPage: "Lignes par page :",
		displayedRows: "{from}-{to} sur {count}",
	},
} satisfies Messages;
