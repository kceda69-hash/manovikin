import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listBlogPostsTool from "./tools/list-blog-posts";
import getPricingTool from "./tools/get-pricing";
import searchSiteTool from "./tools/search-site";
import manovikCapabilitiesTool from "./tools/manovik-capabilities";
import manoTool from "./tools/mano";
import manovikAskTool from "./tools/manovik-ask";
import manovikCodeTool from "./tools/manovik-code";
import manovikReverseEngineerTool from "./tools/manovik-reverse-engineer";
import manovikRunTool from "./tools/manovik-run-tool";
import manovikWriteTool from "./tools/manovik-write";
import manovikTranslateTool from "./tools/manovik-translate";
import manovikExtractTool from "./tools/manovik-extract";
import manovikOptimizePromptTool from "./tools/manovik-optimize-prompt";
import manovikModelsTool from "./tools/manovik-models";
import manovikSupplyChainScanTool from "./tools/manovik-supply-chain-scan";

// The OAuth issuer must be the direct Supabase host: on publish SUPABASE_URL is
// rewritten to a proxy host that fails RFC 8414 issuer matching. The project ref
// is inlined at build time by Vite.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "manovik-mcp",
  title: "MANOVIK MCP",
  version: "0.5.0",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  instructions:
    "MANOVIK AI over MCP. MANOVIK's own model MANO 1.1 (plan → draft → adversarial review → synthesis): `mano`. Reasoning/research/planning: `manovik_ask`. Engineering (build, debug, refactor, review, test, architect, optimize) via the Quantum Engineering Protocol: `manovik_code`. Requirements extraction, architecture maps, clone plans and clean-room reimplementation: `manovik_reverse_engineer`. Content and copy: `manovik_write`. Translation and localization: `manovik_translate`. Messy text to structured JSON, classification, entities, sentiment: `manovik_extract`. Prompt rewriting: `manovik_optimize_prompt`. Offline dependency and AI-config auditing: `manovik_supply_chain_scan`. Model/tier routing preview: `manovik_models`. Sandboxed utilities (math, text, time, allow-listed HTTP GET): `manovik_run_tool`. `manovik_capabilities` lists everything, including features that live in the MANOVIK web app. `search_site`, `list_blog_posts` and `get_pricing` cover manovik.in content and pricing.",
  tools: [
    manoTool,
    manovikCapabilitiesTool,
    manovikAskTool,
    manovikCodeTool,
    manovikReverseEngineerTool,
    manovikWriteTool,
    manovikTranslateTool,
    manovikExtractTool,
    manovikOptimizePromptTool,
    manovikSupplyChainScanTool,
    manovikModelsTool,
    manovikRunTool,
    searchSiteTool,
    listBlogPostsTool,
    getPricingTool,
  ],
});

