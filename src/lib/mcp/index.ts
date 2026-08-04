import { defineMcp } from "@lovable.dev/mcp-js";
import listBlogPostsTool from "./tools/list-blog-posts";
import getPricingTool from "./tools/get-pricing";
import searchSiteTool from "./tools/search-site";
import manovikCapabilitiesTool from "./tools/manovik-capabilities";
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

export default defineMcp({
  name: "manovik-mcp",
  title: "MANOVIK MCP",
  version: "0.3.0",
  instructions:
    "MANOVIK AI over MCP. Reasoning/research/planning: `manovik_ask`. Engineering (build, debug, refactor, review, test, architect, optimize) via the Quantum Engineering Protocol: `manovik_code`. Requirements extraction, architecture maps, clone plans and clean-room reimplementation: `manovik_reverse_engineer`. Content and copy: `manovik_write`. Translation and localization: `manovik_translate`. Messy text to structured JSON, classification, entities, sentiment: `manovik_extract`. Prompt rewriting: `manovik_optimize_prompt`. Offline dependency and AI-config auditing: `manovik_supply_chain_scan`. Model/tier routing preview: `manovik_models`. Sandboxed utilities (math, text, time, allow-listed HTTP GET): `manovik_run_tool`. `manovik_capabilities` lists everything, including features that live in the MANOVIK web app. `search_site`, `list_blog_posts` and `get_pricing` cover manovik.in content and pricing.",
  tools: [
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

