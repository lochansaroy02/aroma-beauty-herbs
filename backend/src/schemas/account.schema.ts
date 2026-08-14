import { z } from "zod";

/** Validation for the customer's own account area. */

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

// bcrypt only reads the first 72 bytes; capping here keeps "long" passwords
// from silently collapsing into the same hash.
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

const name = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be at most 100 characters");

const phone = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number");

const otp = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code");

/**
 * Profile edits. Every field is optional so the settings form can send only
 * what changed, but at least one must be present — an empty body that returns
 * 200 reads as "saved" while nothing happened.
 */
export const updateProfileSchema = z
  .object({
    name: name.optional(),
    phone: phone.nullish(),
    email: email.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Nothing to update",
  });

export const verifyEmailChangeSchema = z.object({ otp });

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: password,
  })
  .refine((value) => value.current_password !== value.new_password, {
    path: ["new_password"],
    message: "The new password must be different from the current one",
  });

/**
 * Address fields mirror the UserAddress model. `address_title` is what the
 * customer sees on the card ("Home", "Office"), so it is optional rather than
 * invented for them.
 */
const addressFields = {
  address_title: z.string().trim().max(50).optional(),
  first_name: z.string().trim().min(1, "First name is required").max(50),
  last_name: z.string().trim().min(1, "Last name is required").max(50),
  email,
  phone,
  address_line_1: z.string().trim().min(1, "Address is required").max(255),
  address_line_2: z.string().trim().max(255).optional(),
  city: z.string().trim().min(1, "City is required").max(100),
  state: z.string().trim().min(1, "State is required").max(100),
  zip_code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9\s-]{4,12}$/, "Enter a valid PIN code"),
  country: z.string().trim().min(1).max(100).default("India"),
  is_default: z.boolean().default(false),
};

export const createAddressSchema = z.object(addressFields);

/**
 * Built from the bare field validators rather than `createAddressSchema
 * .partial()`. `.partial()` makes keys optional but leaves their `.default()`
 * intact, so a PATCH touching one field would silently reset `country` to
 * "India" and `is_default` to false.
 */
export const updateAddressSchema = z
  .object({
    ...addressFields,
    country: z.string().trim().min(1).max(100),
    is_default: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Nothing to update",
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
