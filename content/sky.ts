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
export const SKY_ABOUT =
  "The sky here keeps my local time in Toronto. The sun crosses it through my day and sets behind the mountains at my sunset, dusk washes in after it, and at night the moon rises in its real phase. If Claude is working late, the lantern lights the dark.";
