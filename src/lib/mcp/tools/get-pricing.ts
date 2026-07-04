import { defineTool } from "@lovable.dev/mcp-js";

// MANOVIK is a lifetime-license product. Keep this in sync with the pricing
// shown on the marketing site.
const PRICING = {
  product: "MANOVIK AI",
  model: "one-time lifetime license",
  currency: "INR",
  tiers: [
    { name: "Individual", price: 4999, includes: "Lifetime updates, self-host, sovereign mode" },
    { name: "Student", price: 1999, includes: "Same as Individual, requires .edu verification" },
  ],
  notes:
    "No subscription. Self-hosting keeps model, agent, and tools inside your perimeter. See https://manovik.in for the latest.",
} as const;

export default defineTool({
  name: "get_pricing",
  title: "Get MANOVIK pricing",
  description: "Return current MANOVIK pricing tiers and license model.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: JSON.stringify(PRICING, null, 2) }],
    structuredContent: PRICING,
  }),
});
