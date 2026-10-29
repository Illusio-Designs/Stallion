# Stallion retail store

Public B2C store on its own domain. Own pages, orders, customers and blog data (served by `Backendjs/lib/retail`).
Frames and details are copied from the Stallion catalogue by the admin "Sync" action; the store shows MRP only.

- API contract: `Backendjs/lib/retail/API_CONTRACT.md`
- Dev: `npm install && npm run dev` (port 3400). Set `NEXT_PUBLIC_API_URL` (see `.env.example`).
- Pages are server-rendered with revalidation so Google sees real content.
