import CartView from './CartView';

export const metadata = {
  title: 'Your cart',
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return <CartView />;
}
