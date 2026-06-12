import DynamicClient from './DynamicClient';
import { metadataForSlug } from '../../utils/pageMeta';

// Server component: emits per-route SEO metadata from the path segments,
// then renders the client routing logic.
export async function generateMetadata({ params }) {
  const { slug } = await params;
  return metadataForSlug(slug);
}

export default function DynamicPage() {
  return <DynamicClient />;
}
