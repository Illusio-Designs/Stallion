import OrderView from './OrderView';

export const metadata = {
  title: 'Order placed',
  robots: { index: false, follow: false },
};

export default async function OrderPage({ params }) {
  const { number } = await params;
  return <OrderView number={decodeURIComponent(number)} />;
}
