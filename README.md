# Aroma Beauty Herbs

A landing page for the Aroma Beauty Herbs range, and the small admin that
composes it.

| | |
|---|---|
| `frontend/` | Next.js 16 — the public site and the admin panel |
| `backend/` | Express 5 + Prisma 7 + PostgreSQL — admin auth, media, videos, homepage content, contact form |

**This site does not sell anything.** The four facial kits are read from Barber
Syndicate's public catalogue API, and every "Shop now" hands the visitor to
`barbersyndicate.in` to buy. There is no cart, checkout, order, customer account
or local product record anywhere in this repository.

## The range

Four products, resolved by keyword against the brand:

| Key | Product | Buy link |
|---|---|---|
| `bridal` | Bridal Radiance Facial Kit (4-Step) | `/product/bridal-radiance-facial-kit-4-step` |
| `korean` | Korean Glass Glow Facial Kit (4-Step) | `/product/korean-glass-glow-facial-kit-4-step` |
| `japanese` | Japanese Rice Radiance Facial Kit | `/product/japanese-rice-radiance-facial-kit` |
| `d-tan` | D-Tan Facial Kit (4-Step) | `/product/d-tan-facial-kit-4-step` |

Both sides live in `frontend/lib/shop-api.ts`. The buy link is *derived* from
each product's slug rather than kept in a table, because the two always agree —
add a fifth product by adding its key to `PRODUCT_KEYS`, nothing else.

## Getting started

Both apps need their own `.env`:

```bash
cp backend/.env.example backend/.env
```

`backend/.env-instruction.md` documents every variable. Only `DATABASE_URL` and
`JWT_SECRET` are required; the rest have working defaults.

The frontend needs `frontend/.env.local` (or `.env`):

```
API_URL="http://localhost:8080"
MEDIA_BASE_URL="http://localhost:8080"

# Optional — these default to the values below.
# SHOP_API_BASE="https://barbersyndicate.in/api"
# SHOP_STOREFRONT_BASE="https://barbersyndicate.in"
# SHOP_IMAGE_BASE="https://barbersyndicate.in"
```

`SHOP_IMAGE_BASE` is separate because it is read at build time by
`next.config.ts` — `next/image` refuses any host not in its allowlist, so a
product photo from an unlisted origin renders as a broken frame.

### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run seed:home         # fills the homepage blocks so it doesn't render empty
npm run make:admin        # you need an admin account — there is no signup
npm run dev               # http://localhost:8080
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev                  # http://localhost:3000
```

## How the pieces fit

- **Products** come from `GET {SHOP_API_BASE}/products/brand/aroma-beauty-herbs/{key}`,
  cached for five minutes. That cache window is how stale this site's prices and
  stock can be. If the API is unreachable the affected cards are omitted rather
  than the page failing.
- **Product copy** arrives as raw HTML and is sanitised in `lib/rich-text.ts`
  before render — untrusted input regardless of how friendly the source.
- **Media** is stored on the API server's own disk under `MEDIA_ROOT` and served
  at `<MEDIA_BASE_URL>/media/<folder>/<file>`. Only the relative path is in the
  database. On a VPS point `MEDIA_ROOT` outside the deploy directory, or a
  redeploy wipes it — and back it up, because there is no second copy.
- **Uploads** go browser → Next route handler → API, so the session token and
  the API origin never reach the browser.
- **Auth is staff-only.** There is no signup endpoint and no customer accounts.
  `npm run make:admin` promotes an account; `npm run set:password` sets its
  password. A non-Admin account is refused at login.
- **The homepage** is composed from Admin → Customisation: block order,
  visibility, and a layout variant per block. The "featured" block's *contents*
  are the four API products; its position, visibility and layout are still
  yours.
- **Email** (contact form only) goes through Nodemailer over SMTP.

## Useful scripts

| Command | What it does |
|---|---|
| `npm run seed:home` | Seeds the announcement bar, marquee strips and grid tiles |
| `npm run mail:test` | Verifies SMTP credentials and sends one real message |
| `npm run make:admin` | Promotes a user to Admin |
| `npm run media:migrate` | One-off: pulls legacy ImageKit files onto local disk |

## Notes

`.env` files are gitignored and must never be committed — they carry the
database password, the JWT signing secret, and mail credentials.

The Prisma schema still declares the old commerce models (products, orders,
cart, coupons, inventory). Nothing reads or writes them: they were left in place
deliberately so this change could be reverted without data loss. See
`ROLLBACK.md`.
