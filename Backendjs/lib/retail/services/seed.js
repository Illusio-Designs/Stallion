// First-boot defaults for the retail store: settings, text pages and a few FAQs.
// Idempotent: each table is only filled when it is EMPTY, so nothing an admin edited is ever overwritten.
// Never throws, so it can never stop the server from starting. The text is a sensible starting draft:
// the owner should read and adjust it (Retail admin > Content) before the store goes live.
const RetailSetting = require('../models/RetailSetting');
const RetailFaq = require('../models/RetailFaq');
const RetailContent = require('../models/RetailContent');
const { DEFAULT_SETTINGS, SECRET_KEYS } = require('./catalog');

const DEFAULT_CONTENT = {
    about: {
        title: 'About us',
        body: '<p>We sell quality spectacle frames and sunglasses at honest prices, with simple ordering and delivery to your door.</p>'
            + '<p>Every frame is checked before it leaves us, so what you receive matches what you saw online. If you need help choosing a shape or size, message us and we will gladly guide you.</p>',
    },
    privacy: {
        title: 'Privacy policy',
        body: '<h2>What we collect</h2><p>When you place an order we collect your name, phone number, email (optional) and delivery address so that we can deliver it and keep you updated. '
            + 'We also use basic analytics (pages visited and orders placed) to improve the store.</p>'
            + '<h2>How we use it</h2><p>Your details are used only to process and deliver your order, answer your questions and, if you agree, tell you about offers. We do not sell your personal data.</p>'
            + '<h2>Cookies</h2><p>We use cookies to remember your cart and to understand how the store is used. You can clear them in your browser at any time.</p>'
            + '<h2>Your choices</h2><p>To see, correct or remove your details, contact us using the details on the contact page.</p>',
    },
    terms: {
        title: 'Terms and conditions',
        body: '<h2>Using the store</h2><p>By placing an order you confirm that the details you give are correct. Prices are in Indian rupees and include applicable taxes unless stated otherwise.</p>'
            + '<h2>Orders</h2><p>An order is confirmed once we verify it with you. We may cancel an order if an item is out of stock or the details cannot be verified, and we will tell you if so.</p>'
            + '<h2>Product information</h2><p>We try to show colours accurately, but screens differ slightly. Sizes are given in millimetres on each product page.</p>'
            + '<h2>Payment</h2><p>Currently we accept cash on delivery. Please keep the exact amount ready when your parcel arrives.</p>',
    },
    returns: {
        title: 'Returns and refunds',
        body: '<h2>If something is wrong</h2><p>If your frame arrives damaged, defective or different from what you ordered, contact us within 48 hours of delivery with your order number and a photo, and we will arrange a replacement or refund.</p>'
            + '<h2>Conditions</h2><p>Items must be unused, in original condition and packaging. Frames that have been fitted with prescription lenses cannot be returned unless faulty.</p>'
            + '<h2>Refunds</h2><p>Refunds for cash on delivery orders are sent to the bank or UPI account you share with us after we receive and check the returned item.</p>',
    },
    shipping: {
        title: 'Shipping policy',
        body: '<h2>Delivery</h2><p>We pack and dispatch orders within 1 to 2 working days. Delivery usually takes 3 to 7 working days depending on your location. You will get the courier details once your order is dispatched.</p>'
            + '<h2>Charges</h2><p>Shipping is free above the amount shown at checkout. Below that a small delivery charge applies. Cash on delivery may carry a small handling fee, shown before you place the order.</p>'
            + '<h2>Tracking</h2><p>Track your order any time with your order number and phone number on the Track order page.</p>',
    },
};

const DEFAULT_FAQS = [
    { category: 'Orders', question: 'How do I place an order?', answer: '<p>Choose a frame, add it to your cart and check out with your delivery address. You pay on delivery.</p>' },
    { category: 'Orders', question: 'Can I cancel my order?', answer: '<p>Yes, until it is dispatched. Contact us with your order number and we will cancel it.</p>' },
    { category: 'Delivery', question: 'How long does delivery take?', answer: '<p>Usually 3 to 7 working days after dispatch. Enter your pincode at checkout to see the estimate for your area.</p>' },
    { category: 'Delivery', question: 'How can I track my order?', answer: '<p>Open the Track order page and enter your order number and the phone number used for the order.</p>' },
    { category: 'Payment', question: 'Do you offer cash on delivery?', answer: '<p>Yes. You can pay in cash when the parcel arrives. A small handling fee may apply and is shown at checkout.</p>' },
    { category: 'Returns', question: 'What if I receive a damaged frame?', answer: '<p>Message us within 48 hours of delivery with a photo and your order number. We will replace it or refund you.</p>' },
    { category: 'Products', question: 'Can I put prescription lenses in these frames?', answer: '<p>Most of our full-rim frames can be fitted with prescription lenses by your optician. Frames fitted with lenses cannot be returned unless faulty.</p>' },
];

async function seedSettings() {
    if ((await RetailSetting.count()) > 0) return;
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        // findOrCreate: safe if two servers boot at once
        // eslint-disable-next-line no-await-in-loop
        await RetailSetting.findOrCreate({ where: { setting_key: key }, defaults: { value: JSON.stringify(value), is_secret: SECRET_KEYS.includes(key) } });
    }
}

async function seedContent() {
    if ((await RetailContent.count()) > 0) return;
    for (const [key, c] of Object.entries(DEFAULT_CONTENT)) {
        // eslint-disable-next-line no-await-in-loop
        await RetailContent.findOrCreate({ where: { content_key: key }, defaults: { title: c.title, body: c.body } });
    }
}

async function seedFaqs() {
    if ((await RetailFaq.count()) > 0) return;
    await RetailFaq.bulkCreate(DEFAULT_FAQS.map((f, i) => ({ ...f, sort_order: i })));
}

async function seedRetailDefaults() {
    for (const step of [seedSettings, seedContent, seedFaqs]) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await step();
        } catch (err) {
            console.log(`⚠️ Retail default data (${step.name}) skipped:`, err.message);
        }
    }
}

module.exports = { seedRetailDefaults, DEFAULT_CONTENT, DEFAULT_FAQS };
