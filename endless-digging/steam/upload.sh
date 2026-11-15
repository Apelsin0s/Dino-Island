#!/usr/bin/env bash
# Uploads the Windows build (dist/win-unpacked) to Steam with SteamCMD.
#   STEAM_APP_ID, STEAM_DEPOT_ID: numbers from Steamworks
#   STEAM_USER: the Steamworks build account (a separate account with only "Edit App Metadata" + "Publish" rights)
#   BRANCH: "" = upload only (set live by hand in Steamworks), or "beta" to put it on the beta branch at once
set -euo pipefail
cd "$(dirname "$0")"
sed -e "s/\"AppID\" \"0000000\"/\"AppID\" \"$STEAM_APP_ID\"/" -e "s/\"0000001\"/\"$STEAM_DEPOT_ID\"/" -e "s/\"SetLive\" \"\"/\"SetLive\" \"${BRANCH:-}\"/" -e "s/\"Desc\" \"Endless Digging build\"/\"Desc\" \"Endless Digging $(git rev-parse --short HEAD)\"/" app_build.vdf > app_build.local.vdf
steamcmd +login "$STEAM_USER" +run_app_build "$(pwd)/app_build.local.vdf" +quit
