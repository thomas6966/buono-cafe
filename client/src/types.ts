export type Lang = 'uz' | 'ru';
export type Fulfillment = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
export type PaymentMethod = 'CLICK' | 'PAYME' | 'UZUM' | 'CASH' | 'TERMINAL';
export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'ON_THE_WAY' | 'COMPLETED' | 'CANCELLED';
export type Tag = 'vegetarian' | 'chef' | 'bestseller';

export interface Variant { id: number; label: string; price: number }
export interface Product {
  id: number; categoryId: number; nameUz: string; nameRu: string; descUz: string; descRu: string;
  price: number; imageUrl: string | null; tags: Tag[]; allowMilk: boolean; allowSugar: boolean; variants: Variant[];
}
export interface Category { id: number; slug: string; nameUz: string; nameRu: string; icon: string; products: Product[] }
export interface Addon { id: number; kind: 'MILK' | 'EXTRA'; nameUz: string; nameRu: string; price: number; categorySlugs: string[] }
export interface Settings {
  deliveryFee: number; freeDeliveryFrom: number; minOrder: number; bonusPercent: number; maxBonusPercent: number; prepMinutes: number;
}
export interface Menu { categories: Category[]; addons: Addon[]; settings: Settings }

export interface User {
  id: number; telegramId: string; firstName: string; lastName: string | null; username: string | null;
  photoUrl: string | null; language: Lang; phone: string | null; bonusPoints: number;
}
export interface Address { id: number; label: string; address: string; lat: number | null; lng: number | null }

export interface CartItem {
  key: string; productId: number; variantId: number | null; milkId: number | null;
  sugar: number | null; addonIds: number[]; quantity: number;
}

export interface OrderItem {
  id: number; productId: number | null; nameUz: string; nameRu: string; imageUrl: string | null;
  variantLabel: string | null; quantity: number; unitPrice: number; lineTotal: number;
  options: { variantId?: number; milk?: { id: number; nameUz: string; nameRu: string }; sugar?: number; addons?: { id: number; nameUz: string; nameRu: string }[] };
}
export interface Order {
  id: number; number: number; status: OrderStatus; fulfillment: Fulfillment; paymentMethod: PaymentMethod;
  paymentStatus: 'UNPAID' | 'PAID'; tableNumber: string | null; scheduledFor: string | null; address: string | null;
  subtotal: number; discount: number; bonusUsed: number; bonusEarned: number; deliveryFee: number; total: number;
  promoCode: string | null; estimatedMinutes: number; createdAt: string; items: OrderItem[];
}
export interface Quote {
  totals: { subtotal: number; discount: number; bonusUsed: number; bonusEarned: number; deliveryFee: number; total: number; estimatedMinutes: number };
  promo: { code: string; type: string; value: number } | null;
  promoError: string | null;
}
