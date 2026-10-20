import type { Period } from "@/lib/sky";

// The inscription in the sky's corner reads "<SKY_PLACE> · <time>".
export const SKY_PLACE = "toronto";

export const PERIOD_LABEL: Record<Period, string> = {
  night: "night",
  dawn: "dawn",
  morning: "morning",
  afternoon: "afternoon",
  dusk: "dusk",
};

// The sky's scroll.
export const SKY_TITLE = (clock: string) => `Toronto, ${clock}`;
export const SKY_ABOUT = "Synced to my local time in Toronto, with the real sunset and moon phase.";
