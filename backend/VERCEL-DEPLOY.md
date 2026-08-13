# Deploying the backend to Vercel

The API runs on Vercel as a single serverless function. `api/index.ts` exports
the same Express app the VPS entry point uses — nothing is forked, and
`src/index.ts` still works unchanged for `npm run dev` and for a real server.

## Read this first: two limits Vercel imposes

**1. There is no writable disk.** The local media driver cannot work on Vercel.
Files written during a request are gone with the instance, and most of the
filesystem is read-only anyway. Uploads must go to ImageKit, which is what the
stored `media_driver` setting already says. The Media storage toggle in
**Admin → Customisation** now refuses to select local on a Vercel deployment
rather than accepting the setting and losing every subsequent upload.

Local storage is not deprecated — it remains the right choice on a VPS, where
the disk persists. It is simply unavailable on this particular host.

**2. Request bodies are capped at 4.5 MB.** `MAX_UPLOAD_BYTES` allows 100 MB,
but anything over 4.5 MB is rejected by the platform before Express sees it, so
the API cannot return its own error message for it. Product photos (~100–200 KB)
are unaffected. Hero videos are the risk: the two currently in the project are
under 700 KB, but a normal 1080p clip will exceed the limit. Upload large video
directly in the ImageKit dashboard and reference it, or serve video from a host
without this cap.

## 1. Create the project

The repository holds both apps, so the backend needs its own Vercel project
pointed at the subdirectory.

- Import `https://github.com/lochansaroy02/aroma-beauty-herbs`
- **Root Directory: `backend`**
- Framework Preset: **Other**
- Leave the build and output settings alone — `vercel.json` and the
  `vercel-build` script cover them.

## 2. Environment variables

Set these in **Project → Settings → Environment Variables** before the first
deploy. Values come from `backend/.env`; the ones marked *new* do not exist
there yet.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | the Neon connection string |
| `DATABASE_SCHEMA` | `public` |
| `JWT_SECRET` | as in `.env` |
| `JWT_EXPIRES_IN` | `7d` |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | the deployed storefront's origin — **not** `*` |
| `APP_NAME` | `Aroma Beauty Herbs` |
| `APP_URL` | the deployed storefront's origin |
| `MEDIA_DRIVER` | `imagekit` |
| `IMAGEKIT_PUBLIC_KEY` | as in `.env` |
| `IMAGEKIT_PRIVATE_KEY` | as in `.env` |
| `IMAGEKIT_URL_ENDPOINT` | `https://ik.imagekit.io/d7ek3uosg` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | as in `.env` |
| `SMTP_PASSWORD` | the Gmail app password, unspaced |
| `MAIL_FROM` | as in `.env` |
| `MAIL_REPLY_TO` | as in `.env` |
| `CONTACT_EMAIL` | as in `.env` |
| `ORDER_RESERVATION_MINUTES` | `30` |
| `CRON_SECRET` | *new* — `openssl rand -base64 32` |
| `RAZORPAY_KEY_ID` | leave unset until the live keys arrive |
| `RAZORPAY_KEY_SECRET` | likewise |
| `RAZORPAY_WEBHOOK_SECRET` | likewise |

`PORT`, `MEDIA_ROOT` and `MEDIA_BASE_URL` are deliberately absent: Vercel owns
the port, and the other two only matter to the local driver, which cannot run
here.

`CORS_ORIGIN` defaults to `*` when unset. That is fine locally and wrong in
production — set it to the storefront's origin.

## 3. Point the frontend at it

The storefront reads `API_URL` ([frontend/lib/api.ts](../frontend/lib/api.ts)).
After the first successful deploy, set `API_URL` in the frontend's environment
to the backend's URL, and add the ImageKit host to `next.config.ts`
`remotePatterns` if it isn't already there.

## 4. Verify

```
curl https://<deployment>/health
```

Expect `{"status":"ok","media":{"driver":"imagekit",...,"ready":true}}`. A
`driver` of `local` means `loadActiveDisk` could not reach the database — check
`DATABASE_URL` before uploading anything.

Then check the cron route answers, since it is the one thing no page exercises:

```
curl -H "Authorization: Bearer $CRON_SECRET" https://<deployment>/internal/sweep
```

Worth exercising by hand after the first deploy, because neither has an
equivalent locally:

- **A product image upload**, end to end through Admin → Products.
- **The Razorpay webhook**, once live keys exist. Its signature is computed over
  the raw request body, and a serverless platform that pre-parses the body would
  break that check. Nothing here suggests Vercel does, but it is not verifiable
  until a real webhook arrives.

## Notes

**Database migrations do not run on deploy.** `vercel-build` was
`prisma generate && prisma migrate deploy && tsc`; `migrate deploy` is now
removed. The Neon database was created with `prisma db push`, so it has no
`_prisma_migrations` table, and the single migration on disk
(`20260807113246_initiate`) predates several schema changes. `migrate deploy`
would try to create tables that already exist and fail every build. Schema
changes are applied deliberately from a workstation with `prisma db push`.

**Scheduled sweeps are coarse on the Hobby plan.** Vercel Cron there fires at
most once a day, which is too infrequent for a 30-minute reservation hold, so
`vercel.json` schedules it at `0 3 * * *` and the function also sweeps
opportunistically — any request may trigger one, at most once per instance per
five minutes. On Pro, change the schedule to `*/5 * * * *` and the opportunistic
path becomes a backstop. Both are compare-and-set and safe to overlap.

**Cold starts.** Each new instance runs one extra query to read the media driver
before serving its first request. Neon's pooled endpoint keeps that cheap.

**`public/` exists to satisfy the build, not to serve a site.** Defining a build
command makes Vercel insist on static output afterwards, and an API has none —
the first deploy failed with *No Output Directory named "public" found*. The
directory holds one placeholder page. Vercel checks the filesystem before
applying `rewrites`, so that page answers `/` and every other path still reaches
the function.

**`.vercelignore` patterns are matched against the whole repository**, not just
this directory, and they are gitignore-style — so an unanchored `media/` also
matched `frontend/app/api/media/`, which the first deploy duly deleted from the
build. The patterns are anchored now. Worth remembering before adding another.
