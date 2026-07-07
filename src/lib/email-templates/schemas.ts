import { z } from "zod";

/**
 * Zod schemas for every auth email template's variables.
 * The auth webhook builds template props from the Supabase Auth payload;
 * these schemas describe the shape each template consumes so we can:
 *   - unit-test that templates reject unsafe / missing values, and
 *   - assert renderers actually surface the required variables.
 *
 * URL fields are locked to https:// so a compromised payload can't inject
 * javascript:/data: links into the rendered email.
 */
const httpsUrl = z
  .string()
  .url()
  .max(2048)
  .refine((u) => /^https:\/\//i.test(u), {
    message: "confirmationUrl must be https://",
  });

const email = z.string().email().max(254);
const siteName = z.string().min(1).max(120);
const siteUrl = z
  .string()
  .url()
  .max(2048)
  .refine((u) => /^https:\/\//i.test(u), { message: "siteUrl must be https://" });
const token = z.string().min(6).max(64);

export const SignupSchema = z.object({
  siteName,
  siteUrl,
  recipient: email,
  confirmationUrl: httpsUrl,
});

export const MagicLinkSchema = z.object({
  siteName,
  confirmationUrl: httpsUrl,
});

export const RecoverySchema = z.object({
  siteName,
  confirmationUrl: httpsUrl,
});

export const InviteSchema = z.object({
  siteName,
  siteUrl,
  recipient: email,
  confirmationUrl: httpsUrl,
});

export const EmailChangeSchema = z.object({
  siteName,
  confirmationUrl: httpsUrl,
  oldEmail: email,
  newEmail: email,
});

export const ReauthenticationSchema = z.object({
  siteName,
  token,
});

export const AUTH_TEMPLATE_SCHEMAS = {
  signup: SignupSchema,
  invite: InviteSchema,
  magiclink: MagicLinkSchema,
  recovery: RecoverySchema,
  email_change: EmailChangeSchema,
  reauthentication: ReauthenticationSchema,
} as const;

export type AuthTemplateName = keyof typeof AUTH_TEMPLATE_SCHEMAS;
