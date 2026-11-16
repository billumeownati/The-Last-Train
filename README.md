# The Last Train

A browser social-deduction game on a night train, for **four to six friends**.

> *One of you does not belong. One of you must stay.*

On the night of 14 November 1936 a green Packard left Harrow Hall for the last train. It never arrived.
Now you ride a train on no timetable through five stretches of that night. Search the carriages for evidence, argue at dinner,
and at the Last Platform vote on who stays aboard. Everyone else steps down. One of you is the **Stowaway**, and they don't know it.

* **Authoritative server.** Roles, clues and the Stowaway never leave the server until they are meant to.
* **Voice and text.** Built-in peer-to-peer voice at dinner, forced off while you roam, plus proximity text chat per carriage.
* **Inked Noir Deco.** A toon-shaded, ink-outlined 3D train in front of painted parallax scenery that changes at every station (forest, flood, fire, snow, dark).
* **The whole story is one editable JSON file.**

This is **v1: a friends playtest**. Room codes, no accounts, no database, desktop Chrome or Firefox.
The goal is to find out whether a group finishes a game and wants another.

---

## Play it

Requires **Node 20+**.

```bash
npm install
npm run play
```

Then open **http://localhost:3000**, type a name and *Host a train*. Friends join with the 4-letter room code.

To play over the internet (and so that microphones work, which need https), tunnel your local server:

```bash
cloudflared tunnel --url http://localhost:3000
```

Share the `https://…trycloudflare.com` address. See [`docs/PLAYTEST-GUIDE.md`](docs/PLAYTEST-GUIDE.md) for the full session guide.

### Try it alone

```bash
npm run dev:fast            # server + hot-reloading client (http://localhost:5173), every timer 5x faster
npm run bots -- ABCD 3      # in a second terminal: three bot passengers join room ABCD
```

A full game normally takes about **45 minutes**. `TIME_SCALE=0.2` makes it about 9.

## Scripts

| Command | What it does |
|---|---|
| `npm run play` | build the client, then serve everything on port 3000 |
| `npm run dev` | server (`:3000`, watch mode) + Vite client (`:5173`) |
| `npm run dev:fast` | the same, with every timer five times faster |
| `npm test` | 53 server tests: dealing, rules, privacy, full bot games for 4, 5 and 6 players |
| `npm run typecheck` | `tsc` on all workspaces |
| `npm run validate:story` | lint `content/story.json` |
| `npm run bots -- CODE [n]` | add `n` bot passengers to a room |

Environment: `PORT` (3000), `HOST` (0.0.0.0), `TIME_SCALE` (1), `STORY_PATH` (path to a different story file).
On Windows PowerShell, set an environment variable with `$env:TIME_SCALE = 0.2`, or use `cross-env` as `npm run dev:fast` does.

## Repository

```
shared/    @tlt/shared   constants, view types, socket protocol
server/    @tlt/server   Node + Socket.IO authoritative game (+ tests, bots, story validator)
client/    @tlt/client   Vite + React UI over a three.js scene
content/   story.json    the whole backstory: roles, ~30 clues, events, visions, ballots, epilogues
design/    style-b.html  the confirmed art reference
reference/ …             mood images
docs/                    design, architecture, content guide, playtest guide, roadmap
```

## Documentation

| Doc | For |
|---|---|
| [`docs/GAME-DESIGN.md`](docs/GAME-DESIGN.md) | the rules exactly as built: phases, carriages, clues, conductor, ballots, the Stowaway, endings, edge cases |
| [`docs/CONTENT-GUIDE.md`](docs/CONTENT-GUIDE.md) | how to edit the story: schema, placeholders, dropping roles, checklist |
| [`docs/PLAYTEST-GUIDE.md`](docs/PLAYTEST-GUIDE.md) | hosting a session, what to watch for, known limits, post-game questions |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | server authority and secrecy, the phase machine, the protocol, the scene, voice, testing |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | what is deliberately deferred |

## Status

v1 is complete and playable end to end: lobby, briefing, five stations, ballots, the final vote and endings, with voice, per-carriage chat,
reconnects, and bot-driven tests. Not yet playtested with real people. Known limits are in the [playtest guide](docs/PLAYTEST-GUIDE.md).
