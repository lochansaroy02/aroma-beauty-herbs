import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Add it to backend/.env`
    );
  }
  return value;
}

const smtpUser = process.env["SMTP_USER"] ?? "";

// Google displays app passwords as "abcd efgh ijkl mnop". SMTP wants the 16
// characters unspaced, and pasting them as shown otherwise fails with a bare
// "535 Username and Password not accepted".
const smtpPassword = (process.env["SMTP_PASSWORD"] ?? "").replace(/\s+/g, "");

export const env = {
  NODE_ENV: process.env["NODE_ENV"] ?? "development",
  DATABASE_URL: required("DATABASE_URL"),
  // Postgres schema holding the tables. Set explicitly because some hosts
  // (Neon's pooler among them) return an empty search_path, which leaves
  // unqualified table names unresolvable.
  DATABASE_SCHEMA: process.env["DATABASE_SCHEMA"] || "public",
  JWT_SECRET: required("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env["JWT_EXPIRES_IN"] ?? "7d",
  PORT: Number(process.env["PORT"] ?? 4000),
  CORS_ORIGIN: process.env["CORS_ORIGIN"] ?? "*",

  // Shown in the mail Nodemailer sends, and linked from its footer. Receivers
  // score a nameless sender worse, so these are content, not decoration.
  APP_NAME: process.env["APP_NAME"] || "Aroma Beauty Herbs",
  APP_URL: (process.env["APP_URL"] ?? "https://aromabeautyherbs.com").replace(/\/+$/, ""),

  // Media lives on this server's own disk. Only the relative path is stored in
  // the database, so moving the files or putting a domain in front of them is a
  // change to these two values and nothing else.
  //
  // MEDIA_ROOT: where bytes are written. Relative paths resolve from the
  // process's working directory; on a VPS set an absolute path outside the
  // deploy directory (e.g. /var/www/aroma/media) so a redeploy can't wipe it.
  MEDIA_ROOT: process.env["MEDIA_ROOT"] || "./media",
  // MEDIA_BASE_URL: the origin files are reachable at. Must be what a browser
  // can actually resolve — not "localhost" once anyone else has to load a page.
  MEDIA_BASE_URL: (
    process.env["MEDIA_BASE_URL"] || `http://localhost:${process.env["PORT"] ?? 4000}`
  ).replace(/\/+$/, ""),

  /**
   * Which storage NEW uploads go to: "local" or "imagekit".
   *
   * Only new ones. Every media row records the disk it was written to, and URLs
   * and deletes are resolved from that, so flipping this leaves everything
   * already uploaded working exactly where it is.
   */
  MEDIA_DRIVER: (process.env["MEDIA_DRIVER"] || "local").trim().toLowerCase(),

  // ImageKit, used when MEDIA_DRIVER=imagekit. Only the file path is stored, so
  // moving to a custom domain is a change to the endpoint alone.
  IMAGEKIT_PUBLIC_KEY: process.env["IMAGEKIT_PUBLIC_KEY"] ?? "",
  IMAGEKIT_PRIVATE_KEY: process.env["IMAGEKIT_PRIVATE_KEY"] ?? "",
  IMAGEKIT_URL_ENDPOINT: (process.env["IMAGEKIT_URL_ENDPOINT"] ?? "").replace(/\/+$/, ""),

  // Razorpay. Live keys arrive once the business is verified on their dashboard;
  // until then these stay as placeholders and checkout runs in unpaid mode.
  RAZORPAY_KEY_ID: (process.env["RAZORPAY_KEY_ID"] ?? "").trim(),
  RAZORPAY_KEY_SECRET: (process.env["RAZORPAY_KEY_SECRET"] ?? "").trim(),
  RAZORPAY_WEBHOOK_SECRET: (process.env["RAZORPAY_WEBHOOK_SECRET"] ?? "").trim(),

  // How long an unpaid order may hold its stock before the sweeper takes it
  // back. Long enough for a slow bank page, short enough that abandoned
  // checkouts don't make the catalogue read as sold out.
  ORDER_RESERVATION_MINUTES: Math.max(
    5,
    Number(process.env["ORDER_RESERVATION_MINUTES"] ?? 30) || 30
  ),

  // Shared secret the scheduler presents to /internal/sweep. Only needed where
  // the schedule lives outside the process (Vercel Cron); the VPS entry point
  // runs the sweep on its own timer and never calls that route.
  CRON_SECRET: process.env["CRON_SECRET"] ?? "",

  // SMTP is optional: with no SMTP_HOST the mailer logs to the console instead,
  // so signup can be exercised locally without credentials.
  SMTP_HOST: process.env["SMTP_HOST"] ?? "",
  SMTP_PORT: Number(process.env["SMTP_PORT"] ?? 587),
  SMTP_SECURE: process.env["SMTP_SECURE"] === "true",
  SMTP_USER: smtpUser,
  SMTP_PASSWORD: smtpPassword,
  // Gmail rewrites From to the authenticated account, so default to it rather
  // than send a mismatched address.
  MAIL_FROM:
    process.env["MAIL_FROM"] ||
    (smtpUser ? `Aroma Beauty Herbs <${smtpUser}>` : "Aroma Beauty Herbs <no-reply@example.com>"),
  // A Reply-To that reaches a human is one of the cheapest trust signals there
  // is; a no-reply address that bounces is one of the most expensive.
  MAIL_REPLY_TO: process.env["MAIL_REPLY_TO"] ?? "",
  // Where contact-form enquiries are sent. Falls back to the reply-to address,
  // then to the SMTP account, so it works without extra configuration.
  CONTACT_EMAIL:
    process.env["CONTACT_EMAIL"] || process.env["MAIL_REPLY_TO"] || smtpUser,
} as const;

export const isProduction = env.NODE_ENV === "production";

/**
 * Running on Vercel, where the filesystem is read-only apart from a /tmp that
 * is discarded with the instance. Set by the platform, so it is true on the
 * deployment and false everywhere else without any configuration.
 *
 * The consequence that matters: the local media driver cannot store anything
 * there, so a switch to it has to be refused rather than silently lose files.
 */
export const isServerless = Boolean(process.env["VERCEL"]);

/** All three are needed to upload; without them the ImageKit driver won't start. */
export const isImageKitConfigured = Boolean(
  env.IMAGEKIT_PUBLIC_KEY && env.IMAGEKIT_PRIVATE_KEY && env.IMAGEKIT_URL_ENDPOINT
);


/**
 * Real Razorpay keys are `rzp_test_…` or `rzp_live_…`. Anything else — blank, or
 * the placeholder shipped in .env.example — means payments aren't live yet, and
 * checkout says so instead of failing at the API call.
 */
export const isRazorpayConfigured =
  /^rzp_(test|live)_[A-Za-z0-9]+$/.test(env.RAZORPAY_KEY_ID) &&
  env.RAZORPAY_KEY_SECRET.length > 8;

/** Webhooks are only trustworthy once a signing secret is set. */
export const isRazorpayWebhookConfigured =
  isRazorpayConfigured && env.RAZORPAY_WEBHOOK_SECRET.length > 8;

/**
 * All three are required to actually send. A host without credentials makes
 * Gmail reject at MAIL FROM with "530 Authentication Required", so treat that
 * as unconfigured and fall back to console delivery instead.
 */
export const isSmtpConfigured = Boolean(
  env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD
);

/** Half-configured: a host was set, but the credentials to use it were not. */
export const isSmtpIncomplete = Boolean(
  env.SMTP_HOST && !(env.SMTP_USER && env.SMTP_PASSWORD)
);

/** The bare address inside `MAIL_FROM`, which may be a `Name <addr>` pair. */
export const mailFromAddress = (
  env.MAIL_FROM.match(/<([^>]+)>/)?.[1] ?? env.MAIL_FROM
).trim();

/**
 * Whether the visible From address is one the SMTP account may actually speak
 * for. When it isn't, receivers see a From that nothing in SPF or DKIM covers —
 * the single most reliable way to land in spam. Gmail papers over it by
 * rewriting the header; most other hosts do not, so this is worth saying out
 * loud at boot either way.
 */
export const isMailFromAligned =
  !isSmtpConfigured ||
  mailFromAddress.toLowerCase() === env.SMTP_USER.toLowerCase() ||
  // A domain-authenticated sender (SES, Resend, Brevo…) sends as its own
  // domain, not as the SMTP username, so matching the domain is enough.
  mailFromAddress.split("@")[1]?.toLowerCase() ===
    env.SMTP_USER.split("@")[1]?.toLowerCase();
