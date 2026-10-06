import { createFileRoute } from "@tanstack/react-router";
import { SecurityPage } from "@/components/seclab/SecurityPage";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security Lab — MANOVIK" },
      {
        name: "description",
        content:
          "MANOVIK Security Lab: defensive, read-only security scans for websites you own — headers, TLS, exposed paths, cookies, CORS.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SecurityPage,
});
