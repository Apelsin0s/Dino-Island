# Endless Digging — co-op, Steam, maintenance

## Pieces

| Piece | Where | What it does |
|---|---|---|
| Game | `src/` | The same code for the web link, the Steam build and solo/co-op. `net.js` is the link to the server. |
| Rules | `src/rules.js` | Tools, research tree, prices, "what is a scoop worth". Shared by the game and the server. |
| Server | `server/` | One shared Earth: holes, money, research, chat, bans. Node 22 + `ws`. |
| Steam build | `electron/`, `steam/` | A desktop window around `src/`, Steam sign-in ticket and overlay (`steamworks.js`). |
| CI | `.github/workflows/endless-digging.yml` | Every push: all scripts parse + server tests. By hand: Windows build, optional upload to Steam. |

## How co-op works

- The game signs in (`hello`): Steam session ticket in the Steam build (the server checks it with Steam's Web API),
  a guest token in development (`ALLOW_GUESTS=1`).
- Each account gets its own plot on a spiral around Kryvyi Rih (150 m apart); the shack stands there.
- Digging: the game shows the hole at once and sends `dig {c, r, mode}`. The server checks the tool the account owns,
  the pace (tool time × upgrades) and the distance, measures the scoop with the game's own code
  (`Rules.scoop`, same relief and ground), digs it, pays, and sends the hole to everyone who can see that place.
  The game takes the server's balance as the truth.
- Research is bought on the server (`buy {id}`), so money cannot be edited in the browser.
- Machines and rigs that work by themselves are paid by the server once a second at their average rate (they do not
  dig in the shared world yet, so a hundred bases do not turn the start into one crater). Driven excavators dig for real.
- The planet is cut into 64 m cells. A player receives the holes of the cells within about 200 m and the players
  within 220 m; chat is heard by the players around (no private messages: children play).
- Chat moderation (`server/moderation.js`): swear words in many languages (also written with dots/spaces or mixed
  Latin/Cyrillic), links, e-mails, phone numbers and social handles are hidden; flood control; three hidden messages
  in a row mute the player for 10 minutes; `report` stores complaints for the owner.
- Owner commands, typed in chat: `/ban <player> <reason>` (permanent), `/unban <id>`, `/mute <player> <minutes>`,
  `/unmute`, `/kick`, `/say <text>`, `/who`. Owners are listed in `OWNER_STEAMIDS`.
- Storage: `data/holes.bin` (32 bytes per hole, append-only), `accounts.json`, `bans.json`, `mutes.json`, and logs
  `chat.log`, `reports.log`, `errors.log`. A restart loses nothing.
- Crash reports: the game posts uncaught errors to `/api/error`; they can be read at `/api/admin/errors`
  (header `Authorization: Bearer $ADMIN_API_TOKEN`). `/health` shows players, holes, memory.

## Running it

```
cd server && npm install
ALLOW_GUESTS=1 node server.js                       # http://localhost:8790/health
# game:  http://localhost:8765/index.html?server=ws://localhost:8790&mode=coop
node test/smoke.js                                  # two players, digging, cheats, chat, bans, restart
```

Production (one machine): `server/docker-compose.yml` runs the server behind Caddy (automatic HTTPS → `wss://`).
Fill `server/.env` from `.env.example`, put the domain in `Caddyfile`, `docker compose up -d --build`.
Steam build: put the app id and `wss://` address into `electron/config.json`; `npm install && npx electron-builder --win --dir`.

## The ground (same on the game, the mesher threads and the server)

- Whole Earth: `src/dem/world/` (15° blocks, 1/30° grid), built by `tools/build-world-dem.py`.
- ~40 m patches of 57 famous places: `src/dem/patches/`, `tools/build-patches.py`.
- Lakes and rivers: `src/dem/water/`, `tools/build-water.py` (lake beds and river channels are cut into the ground).
- HD relief (Steam build + server): Terrarium zoom-12 tiles (~40 m) streamed around each player; the server caches
  them in `DATA_DIR/tiles` and loads the tile under a dig before measuring it (`HD_TILES=0` turns it off — then the
  game must not use them either, or digs are measured on different ground).

## Capacity and growing

One process: hundreds of players at once (each sends ~11 small messages a second; holes go only to who can see them).
Beyond that the planet is split between processes by region (each owns a set of cells, players are handed over at
the border), accounts move to Postgres and chat across regions goes through Redis. The cell design and the
"server measures every dig" rule are what make this split possible later without changing the game.

## Not done yet (next steps)

Other players' shacks and machines on screen; corporations (up to 100, treasury), player market; profiles (avatar,
level, stats, achievements, friends, showcase, mirror, 1st/3rd person); skins (50 + 50 + 50) and the gold currency
through Steam microtransactions (server-side `ISteamMicroTxn`); voice chat (off by default for children, friends and
corporation only); seasons and corporate raids with courts (postponed by the owner).
