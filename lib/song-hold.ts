// A video asks the site's song to step aside while it plays (SongPlayer
// listens), and hands it back when it pauses, ends or goes away.
export const HOLD_SONG = "ink:hold-song";
export const RELEASE_SONG = "ink:release-song";

export const holdSong = () => window.dispatchEvent(new Event(HOLD_SONG));
export const releaseSong = () => window.dispatchEvent(new Event(RELEASE_SONG));
