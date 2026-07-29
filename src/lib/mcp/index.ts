import { defineMcp } from "@lovable.dev/mcp-js";
import listBlogPostsTool from "./tools/list-blog-posts";
import getPricingTool from "./tools/get-pricing";
import searchSiteTool from "./tools/search-site";
import manovikCapabilitiesTool from "./tools/manovik-capabilities";
import manovikAskTool from "./tools/manovik-ask";
import manovikCodeTool from "./tools/manovik-code";
import manovikReverseEngineerTool from "./tools/manovik-reverse-engineer";
import manovikRunTool from "./tools/manovik-run-tool";

export default defineMcp({
  name: "manovik-mcp",
  title: "MANOVIK MCP",
  version: "0.2.0",
  instructions:
    "MANOVIK AI over MCP. Use `manovik_ask` for reasoning, research, planning and general knowledge; `manovik_code` for building, debugging, refactoring, reviewing, testing, architecting or optimizing code (Quantum Engineering Protocol); `manovik_reverse_engineer` for requirements extraction, architecture maps, clone plans and clean-room reimplementation; `manovik_run_tool` for sandboxed utilities (math, text, time, allow-listed HTTP GET). `manovik_capabilities` lists everything, including features that live in the MANOVIK web app. `search_site`, `list_blog_posts` and `get_pricing` cover manovik.in content and pricing.",
  tools: [
    manovikCapabilitiesTool,
    manovikAskTool,
    manovikCodeTool,
    manovikReverseEngineerTool,
    manovikRunTool,
    searchSiteTool,
    listBlogPostsTool,
    getPricingTool,
  ],
});
