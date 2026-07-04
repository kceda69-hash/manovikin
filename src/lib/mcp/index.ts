import { defineMcp } from "@lovable.dev/mcp-js";
import listBlogPostsTool from "./tools/list-blog-posts";
import getPricingTool from "./tools/get-pricing";
import searchSiteTool from "./tools/search-site";

export default defineMcp({
  name: "manovik-mcp",
  title: "MANOVIK MCP",
  version: "0.1.0",
  instructions:
    "Public MANOVIK tools. Use `search_site` to discover pages on manovik.in, `list_blog_posts` for the blog catalog, and `get_pricing` for current lifetime-license pricing.",
  tools: [listBlogPostsTool, getPricingTool, searchSiteTool],
});
