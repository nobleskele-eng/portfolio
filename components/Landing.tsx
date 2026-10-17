"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AeProject } from "@/content/after-effects";
import { DISCORD_HANDLE, STATUS_LABEL } from "@/content/presence";
import type { HotspotId, Layout } from "@/lib/shanshui/types";
import Landscape from "./landscape/Landscape";
import SongPlayer from "./landscape/SongPlayer";

// The scroll (and the animation library it unrolls with) is only needed once
// something is opened, so it loads after the page instead of with it.
const ScrollPanel = dynamic(() => import("./landscape/ScrollPanel"), { ssr: false });
import { InkDefs } from "./landscape/LinkIcons";
import { AboutPanel, LinksPanel, ProjectsPanel, RecordPanel, type OpenBook } from "./landscape/panels";
import { usePresence } from "./landscape/usePresenceStatus";

const TITLE_ID = "scroll-title";

/**
 * The whole site: an ink landscape (ported from shan-shui-inf) that paints
 * itself on load. The person opens About, the notice board opens Links, the
 * bookshelf opens Projects, the record player shows what's playing on Spotify.
 */
export default function Landing({ aeProjects }: { aeProjects: AeProject[] }) {
  const { pose, discord, spotify, refresh } = usePresence();
  const [open, setOpen] = useState<HotspotId | null>(null);
  const [layout, setLayout] = useState<Layout>("wide");
  // the bookshelf's open volume and page; null is the shelf of spines
  const [book, setBook] = useState<OpenBook | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  // keep the last panel's content while the scroll rolls back up
  const lastRef = useRef<HotspotId | null>(null);
  if (open) lastRef.current = open;
  const shown = open ?? lastRef.current;

  const playing = !!spotify?.isPlaying;
  const status = discord ? `${STATUS_LABEL[discord]} ${DISCORD_HANDLE}` : DISCORD_HANDLE;
  const seals: Record<HotspotId, string> = {
    person: status,
    board: "links",
    shelf: "projects",
    record: playing ? "♪ now playing" : "spotify",
  };
  const labels: Record<HotspotId, string> = {
    person: `About me (${status})`,
    board: "Links",
    shelf: "Projects",
    record: playing && spotify?.track ? `Now playing on Spotify: ${spotify.track}` : "Spotify",
  };

  // the page scrolls (that drives the zoom); hold it still while a scroll is open
  useEffect(() => {
    if (!open) return;
    const el = document.documentElement;
    const prev = el.style.overflow;
    el.style.overflow = "hidden";
    return () => {
      el.style.overflow = prev;
    };
  }, [open]);

  const onOpen = useCallback(
    (id: HotspotId, trigger: HTMLButtonElement) => {
      triggerRef.current = trigger;
      if (id === "record") refresh();
      if (id === "shelf") setBook(null);
      setOpen(id);
    },
    [refresh],
  );

  const onClose = useCallback(() => {
    setOpen(null);
    const t = triggerRef.current;
    if (t) setTimeout(() => t.focus(), 0);
  }, []);

  return (
    <section aria-label="Landscape" className="relative w-full">
      <h1 className="sr-only">stayvyxed</h1>
      <InkDefs />
      <SongPlayer />
      <Landscape
        pose={pose}
        playing={playing}
        seals={seals}
        labels={labels}
        hidden={open !== null}
        onOpen={onOpen}
        onLayout={setLayout}
      />

      <ScrollPanel
        open={open !== null}
        vertical={layout === "tall"}
        size={shown === "shelf" ? (book ? "album" : "wide") : "base"}
        labelledBy={TITLE_ID}
        onClose={onClose}
      >
        {shown === "person" && <AboutPanel titleId={TITLE_ID} />}
        {shown === "board" && <LinksPanel titleId={TITLE_ID} />}
        {shown === "shelf" && (
          <ProjectsPanel titleId={TITLE_ID} aeProjects={aeProjects} book={book} vertical={layout === "tall"} onBook={setBook} />
        )}
        {shown === "record" && <RecordPanel titleId={TITLE_ID} spotify={spotify} />}
      </ScrollPanel>
    </section>
  );
}
