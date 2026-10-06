import { createFileRoute } from "@tanstack/react-router";
import { GestureDeckPage } from "@/components/gesture-deck/GestureDeckPage";

export const Route = createFileRoute("/gesture")({
  head: () => ({
    meta: [
      { title: "Gesture Deck — MANOVIK" },
      {
        name: "description",
        content:
          "Tony Stark-style holographic hand-gesture interface for MANOVIK: see and edit missions, approvals, routines and device activity with your hands.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: GestureDeckPage,
});
