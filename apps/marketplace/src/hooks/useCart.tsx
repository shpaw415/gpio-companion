import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import {
	CART_STORAGE_KEY,
	type CartItem,
	cartCount,
	parseCart,
	updateCartItem,
} from "../lib/cart.ts";

type CartContextValue = {
	items: CartItem[];
	count: number;
	update: (id: string, quantity: number) => void;
	add: (id: string, quantity?: number) => void;
	remove: (id: string) => void;
	clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
	const [items, setItems] = useState<CartItem[]>([]);
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		try {
			setItems(parseCart(window.localStorage.getItem(CART_STORAGE_KEY)));
		} catch {
			setItems([]);
		}
		setHydrated(true);
	}, []);

	useEffect(() => {
		if (!hydrated) return;
		try {
			window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
		} catch {
			// Cart remains available in memory if persistence is blocked.
		}
	}, [hydrated, items]);

	function update(id: string, quantity: number) {
		setItems((current) => updateCartItem(current, id, quantity));
	}

	function add(id: string, quantity = 1) {
		setItems((current) => {
			const existing = current.find((item) => item.id === id)?.quantity ?? 0;
			return updateCartItem(current, id, existing + quantity);
		});
	}

	return (
		<CartContext.Provider
			value={{
				items,
				count: cartCount(items),
				update,
				add,
				remove: (id) =>
					setItems((current) => current.filter((item) => item.id !== id)),
				clear: () => setItems([]),
			}}
		>
			{children}
		</CartContext.Provider>
	);
}

export function useCart(): CartContextValue {
	const value = useContext(CartContext);
	if (!value) throw new Error("useCart must be used within CartProvider");
	return value;
}
