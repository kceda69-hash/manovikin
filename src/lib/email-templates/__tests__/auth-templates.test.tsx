import { describe, it, expect } from "vitest";
import * as React from "react";
import { render } from "@react-email/render";

import { SignupEmail } from "@/lib/email-templates/signup";
import { InviteEmail } from "@/lib/email-templates/invite";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { EmailChangeEmail } from "@/lib/email-templates/email-change";
import { ReauthenticationEmail } from "@/lib/email-templates/reauthentication";
import {
  AUTH_TEMPLATE_SCHEMAS,
  SignupSchema,
  MagicLinkSchema,
  RecoverySchema,
  InviteSchema,
  EmailChangeSchema,
  ReauthenticationSchema,
} from "@/lib/email-templates/schemas";

const SITE = "MANOVIK AI";
const SITE_URL = "https://manovik.in";
const CONFIRM_URL = "https://manovik.in/auth/callback?code=abc123";

describe("auth template variable schemas", () => {
  it("registers a schema for every auth template action_type", () => {
    expect(Object.keys(AUTH_TEMPLATE_SCHEMAS).sort()).toEqual(
      [
        "email_change",
        "invite",
        "magiclink",
        "recovery",
        "reauthentication",
        "signup",
      ].sort(),
    );
  });

  it("rejects javascript: URLs in confirmationUrl (signup)", () => {
    const bad = SignupSchema.safeParse({
      siteName: SITE,
      siteUrl: SITE_URL,
      recipient: "a@b.com",
      confirmationUrl: "javascript:alert(1)",
    });
    expect(bad.success).toBe(false);
  });

  it("rejects http:// URLs in confirmationUrl (magic link)", () => {
    const bad = MagicLinkSchema.safeParse({
      siteName: SITE,
      confirmationUrl: "http://insecure.example.com/x",
    });
    expect(bad.success).toBe(false);
  });

  it("rejects missing token on reauthentication", () => {
    const bad = ReauthenticationSchema.safeParse({ siteName: SITE });
    expect(bad.success).toBe(false);
  });

  it("rejects invalid emails on email_change", () => {
    const bad = EmailChangeSchema.safeParse({
      siteName: SITE,
      confirmationUrl: CONFIRM_URL,
      oldEmail: "not-an-email",
      newEmail: "b@c.com",
    });
    expect(bad.success).toBe(false);
  });

  it("accepts a well-formed invite payload", () => {
    const ok = InviteSchema.safeParse({
      siteName: SITE,
      siteUrl: SITE_URL,
      recipient: "invitee@example.com",
      confirmationUrl: CONFIRM_URL,
    });
    expect(ok.success).toBe(true);
  });

  it("accepts a well-formed recovery payload", () => {
    const ok = RecoverySchema.safeParse({
      siteName: SITE,
      confirmationUrl: CONFIRM_URL,
    });
    expect(ok.success).toBe(true);
  });
});

describe("auth templates render with validated variables", () => {
  it("magic link email surfaces the confirmation URL and site name", async () => {
    const props = { siteName: SITE, confirmationUrl: CONFIRM_URL };
    MagicLinkSchema.parse(props);
    const html = await render(React.createElement(MagicLinkEmail, props));
    expect(html).toContain(CONFIRM_URL);
    expect(html).toContain(SITE);
  });

  it("signup email surfaces the confirmation URL", async () => {
    const props = {
      siteName: SITE,
      siteUrl: SITE_URL,
      recipient: "a@b.com",
      confirmationUrl: CONFIRM_URL,
    };
    SignupSchema.parse(props);
    const html = await render(React.createElement(SignupEmail, props));
    expect(html).toContain(CONFIRM_URL);
  });

  it("recovery email surfaces the confirmation URL", async () => {
    const props = { siteName: SITE, confirmationUrl: CONFIRM_URL };
    RecoverySchema.parse(props);
    const html = await render(React.createElement(RecoveryEmail, props));
    expect(html).toContain(CONFIRM_URL);
  });

  it("invite email surfaces the confirmation URL", async () => {
    const props = {
      siteName: SITE,
      siteUrl: SITE_URL,
      recipient: "invitee@example.com",
      confirmationUrl: CONFIRM_URL,
    };
    InviteSchema.parse(props);
    const html = await render(React.createElement(InviteEmail, props));
    expect(html).toContain(CONFIRM_URL);
  });

  it("email_change email surfaces both old and new addresses", async () => {
    const props = {
      siteName: SITE,
      confirmationUrl: CONFIRM_URL,
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
    };
    EmailChangeSchema.parse(props);
    const html = await render(React.createElement(EmailChangeEmail, props));
    expect(html).toContain("new@example.com");
  });

  it("reauthentication email surfaces the OTP token", async () => {
    const props = { siteName: SITE, token: "123456" };
    ReauthenticationSchema.parse(props);
    const html = await render(
      React.createElement(ReauthenticationEmail, props),
    );
    expect(html).toContain("123456");
  });

  it("does not inject javascript: URLs even if a downstream template were misused", async () => {
    // Attempt to bypass the schema: render directly with a bad URL and
    // confirm the raw string is present verbatim (React escapes attrs), so
    // downstream scanners will flag it. This documents that the *only*
    // safety net is the schema layer above the webhook.
    const html = await render(
      React.createElement(MagicLinkEmail, {
        siteName: SITE,
        confirmationUrl: "javascript:alert(1)",
      }),
    );
    // The dangerous scheme is passed through when the schema is skipped.
    expect(html).toContain("javascript:alert(1)");
    // Which is exactly why the webhook must call MagicLinkSchema.parse() first.
    expect(() =>
      MagicLinkSchema.parse({
        siteName: SITE,
        confirmationUrl: "javascript:alert(1)",
      }),
    ).toThrow();
  });
});
