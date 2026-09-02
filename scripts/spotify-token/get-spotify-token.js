/**
 * One-off helper: obtain a Spotify refresh token.
 *
 * Usage:
 *   1. cd scripts/spotify-token
 *   2. npm install
 *   3. cp .env.example .env  and fill in SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET
 *   4. In the Spotify dashboard, add redirect URI: http://127.0.0.1:8888/callback
 *   5. node get-spotify-token.js
 *   6. Open the printed URL, approve, and copy the SPOTIFY_REFRESH_TOKEN line.
 *
 * Not part of the Next.js app - run standalone.
 */

require("dotenv").config();

const express = require("express");

const PORT = 8888;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPE = "user-read-currently-playing";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Missing SPOTIFY_CLIENT_ID and/or SPOTIFY_CLIENT_SECRET.\n" +
      "Create a .env file in this folder (see .env.example)."
  );
  process.exit(1);
}

const authorizeUrl =
  "https://accounts.spotify.com/authorize?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
  }).toString();

const app = express();

app.get("/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    res.status(400).send(`Authorization failed: ${error}`);
    console.error(`\nAuthorization failed: ${error}`);
    return shutdown(1);
  }

  if (!code) {
    res.status(400).send("Missing 'code' query parameter.");
    console.error("\nCallback hit without a 'code' parameter.");
    return shutdown(1);
  }

  try {
    const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }).toString(),
    });

    const data = await tokenRes.json();

    if (!tokenRes.ok) {
      res.status(500).send("Token exchange failed - check the console.");
      console.error("\nToken exchange failed:", data);
      return shutdown(1);
    }

    res
      .status(200)
      .send("Success! Refresh token printed to the console. You can close this tab.");

    console.log("\n=== Spotify tokens ===");
    console.log(`SPOTIFY_REFRESH_TOKEN=${data.refresh_token}`);
    console.log("\n(access_token below is short-lived and only for a quick test)");
    console.log(`access_token=${data.access_token}`);
    console.log(`scope=${data.scope}`);
    console.log(`expires_in=${data.expires_in}s`);

    return shutdown(0);
  } catch (err) {
    res.status(500).send("Unexpected error - check the console.");
    console.error("\nUnexpected error during token exchange:", err);
    return shutdown(1);
  }
});

const server = app.listen(PORT, () => {
  console.log(`Temporary auth server listening on http://127.0.0.1:${PORT}`);
  console.log("\nOpen this URL in your browser and approve access:\n");
  console.log(authorizeUrl);
  console.log("\nWaiting for the redirect to /callback ...");
});

function shutdown(exitCode) {
  server.close(() => process.exit(exitCode));
  // Safety net in case a keep-alive connection stalls close().
  setTimeout(() => process.exit(exitCode), 2000).unref();
}
