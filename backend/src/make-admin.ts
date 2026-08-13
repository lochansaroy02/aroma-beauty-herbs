/**
 * Promotes an existing account to Admin, so it can upload product images.
 *
 *   npm run make:admin you@example.com
 *
 * The account must already exist and be verified — sign up through the app
 * first, then run this.
 */
import { prisma } from "./lib/prisma";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    console.error("Usage: npm run make:admin <email>");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email, deleted_at: null },
    select: { id: true, email: true, role_as: true, email_verified_at: true },
  });

  if (!user) {
    console.error(`No account found for ${email}`);
    process.exit(1);
  }

  if (!user.email_verified_at) {
    console.warn(
      `Note: ${email} hasn't verified its email yet — it still can't log in.`
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role_as: "Admin" },
    select: { id: true, email: true, role_as: true },
  });

  console.log(`${updated.email} is now ${updated.role_as} (id ${updated.id}).`);
  console.log("Log in again — the role is baked into the token at login.");
  await prisma.$disconnect();
}

void main();
