import '../../styles/article.css';
import '../../styles/content.css';
import ContactForm from '../../components/ContactForm';
import { get } from '../../lib/api';
import { pageMetadata } from '../../lib/seo';

export const revalidate = 300;

export async function generateMetadata() {
  return pageMetadata('/contact', { title: 'Contact us', description: 'Talk to the Stallion team. WhatsApp, email, phone and our store address.' });
}

const digits = (s) => String(s || '').replace(/\D/g, '');

export default async function ContactPage() {
  const res = await get('/settings', { revalidate: 300 });
  const store = (res && res.data && res.data.store) || {};
  const wa = digits(store.whatsapp);
  const waNum = wa.length === 10 ? `91${wa}` : wa;
  const phone = store.support_phone;
  const hasDetails = waNum || store.email || phone || store.address || store.hours;
  const social = store.social || {};

  return (
    <div className="wrap sec">
      <div className="ct">
        <div className="ct__info">
          <h1>Talk to us</h1>
          <p className="mute">We reply within one working day. For order help, WhatsApp is fastest.</p>
          {hasDetails ? (
            <>
              {waNum ? (
                <div className="box"><b>WhatsApp</b>
                  <a className="lnk" href={`https://wa.me/${waNum}`} target="_blank" rel="noopener noreferrer">Chat on +{waNum.replace(/^(\d{2})(\d{5})(\d{5})$/, '$1 $2 $3')}</a>
                </div>
              ) : null}
              {store.email ? <div className="box"><b>Email</b><a className="lnk" href={`mailto:${store.email}`}>{store.email}</a></div> : null}
              {phone ? <div className="box"><b>Phone</b><a className="lnk" href={`tel:${digits(phone) ? '+' + digits(phone).replace(/^0+/, '') : phone}`}>{phone}</a></div> : null}
              {store.address || store.hours ? (
                <div className="box"><b>Visit</b>
                  {store.address ? <address>{store.address}</address> : null}
                  {store.hours ? <span className="mute">{store.hours}</span> : null}
                </div>
              ) : null}
              {Object.values(social).some(Boolean) ? (
                <div className="filters" aria-label="Social media">
                  {Object.entries(social).filter(([, u]) => u).map(([k, u]) => (
                    <a key={k} className="chip" href={u} target="_blank" rel="noopener noreferrer">{k.charAt(0).toUpperCase() + k.slice(1)}</a>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="box"><b>Use the form</b><span className="mute">Send us a message and we will get back to you within one working day.</span></div>
          )}
        </div>
        <ContactForm />
      </div>
    </div>
  );
}
