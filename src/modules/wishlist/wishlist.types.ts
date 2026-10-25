export interface WishlistItemDto {
  id: string;
  productId: string;
  name: string;
  shortCode: string;
  weight: string | null;
  imageUrl: string | null;
  companyName: string | null;
  categoryName: string | null;
  priceRupees: number;
  mrpRupees: number;
  savingsRupees: number;
  discountPercent: number;
  packSize: number;
  packLabel: string;
  inStock: boolean;
  stockQty: number;
  addedAt: Date;
}
