/** サーバーからクライアントコンポーネントへ渡す型（日時は ISO 文字列） */
export type ProductStatus = "draft" | "published" | "sold_out" | "closed" | "deleted";
export type ReservationStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show" | "expired";

export type ProductCard = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  category: string;
  isBox: boolean;
  originalPrice: number;
  rescuePrice: number;
  quantity: number;
  remaining: number;
  maxPerReservation: number;
  pickupStartAt: string;
  pickupEndAt: string;
  status: ProductStatus;
  storeId: string;
  storeName: string;
  storeSlug: string;
  areaId: string;
  plan: "free" | "standard";
};

export type StoreInfo = {
  id: string;
  slug: string;
  name: string;
  category: string;
  areaId: string;
  address: string;
  phone: string;
  description: string;
  openingHours: string;
  pickupNote: string;
  imageUrl: string | null;
  status: "pending" | "active" | "suspended";
  plan: "free" | "standard";
};

export type ReservationView = {
  id: string;
  code: string;
  status: ReservationStatus;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  pickupStartAt: string;
  pickupEndAt: string;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  category: string;
  isBox: boolean;
  estimatedWeightG: number;
  storeId: string;
  storeName: string;
  storeSlug: string;
  storeAddress: string;
  storePickupNote: string;
  areaId: string;
};
