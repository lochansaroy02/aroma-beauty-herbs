# Aroma Beauty Herbs

Herbal skincare storefront and admin, in one repository.

| | |
|---|---|
| `frontend/` | Next.js 16 — storefront, customer account, and the admin panel |
| `backend/` | Express 5 + Prisma 7 + PostgreSQL — the API, auth, orders, and media |

## Getting started

Both apps need their own `.env`. Copy the templates and fill them in:

```bash
cp backend/.env.example backend/.env
```

`backend/.env-instruction.md` documents every variable — what it does, what
breaks without it, and what to change for production. Only `DATABASE_URL` and
`JWT_SECRET` are required; the rest have working defaults.

The frontend needs `frontend/.env.local`:

```
API_URL="http://localhost:8080"
MEDIA_BASE_URL="http://localhost:8080"
```

### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push        # or `migrate deploy` once migrations are baselined
npm run seed:home         # fills the homepage blocks so it doesn't render empty
npm run dev               # http://localhost:8080
```

### Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:3000
```

## How the pieces fit

- **Media** is stored on the API server's own disk under `MEDIA_ROOT` and served
  at `<MEDIA_BASE_URL>/media/<folder>/<file>`. Only the relative path is in the
  database, so moving the files is a change to two environment variables.
  On a VPS point `MEDIA_ROOT` outside the deploy directory, or a redeploy wipes
  every product image — and back it up, because there is no second copy.
- **Uploads** go browser → Next route handler → API, so the session token and the
  API origin never reach the browser.
- **Email** (OTP and contact form) goes through Nodemailer over SMTP. Gmail works
  for development; production wants a provider with your own authenticated
  domain. See `backend/.env-instruction.md`.
- **The homepage** is composed from Admin → Customisation: block order,
  visibility, and a layout variant per block.

## Useful scripts

| Command | What it does |
|---|---|
| `npm run seed:home` | Seeds the announcement bar, marquee strips and grid tiles |
| `npm run mail:test` | Verifies SMTP credentials and sends one real message |
| `npm run make:admin` | Promotes a user to Admin |
| `npm run orders:sweep` | Releases stock held by unpaid orders |
| `npm run media:migrate` | One-off: pulls legacy ImageKit files onto local disk |

## Notes

`.env` files are gitignored and must never be committed — they carry the database
password, the JWT signing secret, and mail credentials. Rotate `JWT_SECRET` for
production; changing it signs every existing session out.
