// Pinned to the notice board. `icon` picks an ink drawing from LinkIcons.tsx.
export type LinkIcon = "tiktok" | "instagram" | "lastfm" | "github" | "discord";

export const LINKS_TITLE = "Links";

export const LINKS: { label: string; handle: string; href: string; icon: LinkIcon }[] = [
  { label: "TikTok", handle: "@stayvyxed", href: "https://www.tiktok.com/@stayvyxed", icon: "tiktok" },
  { label: "TikTok", handle: "@papercheques", href: "https://www.tiktok.com/@papercheques", icon: "tiktok" },
  { label: "Instagram", handle: "@yichxxn", href: "https://www.instagram.com/yichxxn/", icon: "instagram" },
  { label: "Last.fm", handle: "vyxae", href: "https://www.last.fm/user/vyxae", icon: "lastfm" },
  { label: "GitHub", handle: "nobleskele-eng", href: "https://github.com/nobleskele-eng", icon: "github" },
  { label: "Discord", handle: ".vyxed", href: "https://discord.com/users/995695062463823944", icon: "discord" },
];
