#!/usr/bin/env bash
# Fetch Foundry's `cast` for the hosted demo's "Behind the scenes" traces (Vercel build, Linux x86_64).
# Pinned release, checksum-verified; the static Alpine (musl) build runs on any Linux. Locally, the UI
# uses your own Foundry install, so this does nothing off Linux.
set -euo pipefail
if [ "$(uname -s)" != "Linux" ]; then echo "fetch-cast: not Linux, skipping (local Foundry is used)"; exit 0; fi
VERSION=v1.8.1
SHA256=2f36e0e69ea06f413add25be7543996cec59ba48d2e20acad1e10152b17d22c3
DEST=web/bin
if [ -x "$DEST/cast" ]; then "$DEST/cast" --version | head -1; exit 0; fi
mkdir -p "$DEST"
TMP=$(mktemp -d)
curl -fsSL -o "$TMP/foundry.tgz" "https://github.com/foundry-rs/foundry/releases/download/$VERSION/foundry_${VERSION}_alpine_amd64.tar.gz"
echo "$SHA256  $TMP/foundry.tgz" | sha256sum -c -
tar -xzf "$TMP/foundry.tgz" -C "$DEST" cast
chmod 755 "$DEST/cast"
rm -rf "$TMP"
"$DEST/cast" --version | head -1
