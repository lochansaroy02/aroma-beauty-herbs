# Rolling back the landing-page change

On **22 August 2026** this repository stopped being a shop and became a landing
page for the Aroma Beauty Herbs range, with checkout handed off to
`barbersyndicate.in`. It went in as a **single commit** so it can be undone with
a single command.

## Undo it

```bash
# Find the commit
git log --oneline --grep="landing page" -n 5

# Undo it, keeping the history honest
git revert <sha>
```

Then reinstall, because dependencies moved in both directions:

```bash
cd backend  && npm install     # restores razorpay, sanitize-html
cd frontend && pnpm install    # restores input-otp, drops sanitize-html
```

`git revert` creates a new commit that restores every deleted file. Nothing
about the original commit is rewritten, so anyone who already pulled is fine.

To inspect before committing to it: `git revert --no-commit <sha>`, look around,
then `git revert --abort` or `git commit`.

## Why this is safe

**No data was destroyed.** The change is code-only:

- `backend/prisma/schema.prisma` was **not touched**. Every commerce model —
  `Product`, `Order`, `OrderItem`, `CartItem`, `Coupon`, `ProductInventory`,
  `StockTransaction`, `UserAddress`, `Wishlist` and the rest — is still
  declared, and the Prisma client still generates them.
- **No migration was written and no table was dropped.** Every row that existed
  in PostgreSQL before the change still exists after it. Products, past orders
  and their history are simply no longer read.
- Uploaded media under `MEDIA_ROOT` is untouched.
- User accounts are untouched. Customer rows still exist; they are only refused
  at login, by a role check, not deleted.

So a revert restores the code and finds its data waiting. The one thing to
verify afterwards is that `backend/.env` still has working `RAZORPAY_*` values,
since checkout would go live again.

## What the change actually did

**Backend** — removed the catalogue, cart, wishlist, checkout, orders,
inventory, coupons, taxonomy and customer-account endpoints, plus the stock
reservation sweeper. Kept admin auth, media/uploads, videos, homepage
customisation and the contact form.

- Auth lost signup, OTP verification and resend. `POST /auth/login` and
  `GET /auth/me` remain, and login now refuses non-Admin accounts. Admins are
  made with `npm run make:admin`.
- `GET /home` no longer returns a `featured` array. Its other blocks are
  unchanged.
- Videos lost their optional `product_id` link.
- `uploadedImageSchema` moved from `schemas/product.schema.ts` to
  `schemas/uploaded-image.schema.ts`, because the homepage tiles still use it
  and its old home was deleted.

**Frontend** — removed cart, checkout, orders, wishlist, account and signup
pages, and the admin products/orders/inventory/coupons screens. Added
`lib/shop-api.ts` (reads the Barber Syndicate catalogue) and
`lib/rich-text.ts` (sanitises its HTML). "Add to cart" became
`components/shop/shop-now-button.tsx`, an outbound link. `lib/catalog.ts` lost
its commerce types and `ProductImage` was renamed `MediaImage`, which is what it
had actually become.

## Reverting only part of it

The commit is one unit, so a partial revert means checking out the paths you
want from the parent commit:

```bash
# e.g. bring back just the customer account area
git checkout <sha>^ -- 'frontend/app/(shop)/account' \
                       backend/src/controllers/account.controller.ts \
                       backend/src/routes/account.routes.ts \
                       backend/src/schemas/account.schema.ts
```

Expect to re-wire by hand: restored files import things the rest of the change
deleted (`lib/catalog.ts` types, `lib/api.ts` helpers, the API routes in
`backend/src/app.ts`). `npx tsc --noEmit` in each app will list what is missing.
