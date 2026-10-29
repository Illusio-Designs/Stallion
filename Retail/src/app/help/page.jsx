import Link from 'next/link';
import '../../styles/article.css';
import '../../styles/content.css';
import HelpFaq from '../../components/HelpFaq';
import { get } from '../../lib/api';
import { stripHtml } from '../../lib/html';
import { jsonLd, pageMetadata } from '../../lib/seo';

export const revalidate = 600;

export async function generateMetadata() {
  return pageMetadata('/help', { title: 'Help and FAQ', description: 'Answers about delivery, returns, sizing, payment and your order.' });
}

export default async function HelpPage() {
  const res = await get('/faqs', { revalidate: 600 });
  const groups = ((res && res.data) || []).filter((g) => g && Array.isArray(g.items) && g.items.length);
  const all = groups.flatMap((g) => g.items);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: all.map((it) => ({ '@type': 'Question', name: it.question, acceptedAnswer: { '@type': 'Answer', text: stripHtml(it.answer) } })),
  };

  return (
    <div className="wrap sec">
      <div className="art art--wide">
        <h1 className="art__title">Help and FAQ</h1>
        {groups.length > 0 ? (
          <>
            <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(schema)} />
            <HelpFaq groups={groups} />
          </>
        ) : (
          <div className="box">
            <b>{res ? 'No help articles yet' : 'We could not load the help articles'}</b>
            <p className="mute">{res ? 'We are putting them together. Ask us anything in the meantime.' : 'Please try again in a minute, or ask us directly.'}</p>
            <Link href="/contact" className="btn btn--pri">Contact us</Link>
          </div>
        )}
        {groups.length > 0 && (
          <div className="box">
            <b>Still need help?</b>
            <p className="mute">Track an order or send us a message and we will reply within one working day.</p>
            <div className="row" style={{ justifyContent: 'flex-start' }}>
              <Link href="/track" className="btn">Track order</Link>
              <Link href="/contact" className="btn btn--pri">Contact us</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
