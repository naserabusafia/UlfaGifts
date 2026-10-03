export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
}

export interface CartState {
  items: CartItem[];
  totalAmount: number;
}
