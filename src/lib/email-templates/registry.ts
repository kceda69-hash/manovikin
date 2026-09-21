import type { ComponentType } from "react";
import type { ZodTypeAny } from "zod";

import { template as paymentReceipt } from "./payment-receipt";

export interface TemplateEntry {
  component: ComponentType;
  subject: string | ((data: Record<string, unknown>) => string);
  displayName?: string;
  previewData?: Record<string, unknown>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
  /**
   * Zod schema validating caller-supplied templateData. Required — every
   * template MUST declare its accepted props so untrusted callers cannot
   * inject arbitrary values (e.g. `javascript:` URLs) into rendered emails.
   */
  dataSchema: ZodTypeAny;
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  "payment-receipt": paymentReceipt,
};
