# Architecture

TypeScript everywhere, one repo, three npm workspaces.

```
The Last Train/
├─ shared/    @tlt/shared   constants, view types and the socket protocol (the contract)
├─ server/    @tlt/server   Node + Socket.IO. The authoritative game. No database.
├─ client/    @tlt/client   Vite + React UI over a three.js "Inked Noir Deco" train scene
├─ content/   story.json    the whole backstory as editable data
├─ design/    style-b.html  the confirmed art reference (the scene code was lifted from it)
├─ reference/ …             mood images used to pick the art direction
└─ docs/
```

## 1. Authority and secrecy

The server owns every rule. A client is a thin terminal: it sends *intents* (`game:move`, `game:act`, `game:finalVote`, …)
and receives a **view** of the game that was built for *that player*.

* **One function** turns server state into client state: [`buildView`](../server/src/game/views.ts).
  Anything not returned from it never leaves the server: other players' roles, memories, lies, goals, the clues they hold,
  the Stowaway's identity, the contents of unsearched objects, and ending steps that have not been revealed yet.
* Tests assert this (`server/test/rules.test.ts`, "never exposes roles, lies, goals or the stowaway"): for each player's view, none of the
  other players' card text, tokens, `stowawayId`, the Stowaway truth text, or any unfound clue text appears anywhere in the JSON.
* **Proximity is enforced on the server too.** Chat is addressed to the set of players in the sender's carriage at send time;
  other players' `activity` (what someone is searching) is only included in your view when you share a carriage.
* The Stowaway flag lives only in `RoomState.stowawayId` and `PlayerState.isStowaway`, and is only ever read to build that player's own card, to deliver hints, and to build the final ending steps.

## 2. Server

```
server/src/
├─ index.ts          http (static client) + Socket.IO handlers, state broadcast
├─ rooms.ts          room registry, 4-letter codes (no I/O), idle sweep
├─ content.ts        loads + validates content/story.json; {A}/{A:short} role templating
├─ validateStory.ts  `npm run validate:story`
├─ bots.ts           `npm run bots -- CODE 3`: bot passengers for solo testing
└─ game/
   ├─ state.ts       internal state types (RoomState, PlayerState, ObjectState, …)
   ├─ room.ts        the Room class: lobby, dealing, the phase machine, every rule
   ├─ views.ts       buildView(room, playerId)
   └─ util.ts        seeded RNG, shuffle, tokens
```

### The Room

`Room` is a pure state machine with an **injectable clock and RNG** (`now`, `rng`) and a **time scale**.
Nothing in it touches a socket. The network layer calls its methods (`move`, `act`, `ask`, `diningVote`, `finalVote`, …),
which return `{ ok, error? }`, and calls `tick()` four times a second.
`tick()` resolves everything that is time-based: arrivals, search completion, the phase timers, forced reveals, the ending reveal steps.

That is why the server is testable at full speed: tests advance a fake clock and call `tick()`.

### Phase machine

```
lobby ─start→ briefing ─→ roam(1) ─→ event(1) ─→ dining(1) ─→ roam(2) … ─→ dining(5) ─→ finalVote ─→ ending ─playAgain→ lobby
```

* `dining(1..4)` = discussion → ballot (last 20 s) → tally (a few seconds) → next roam.
* `dining(5)` has no ballot; it runs into `finalVote`.
* Every phase can be skipped when all connected players press Ready.
* **Effects** (`ActiveEffect`) carry an `until: {phase, station}` and are dropped when that phase ends. `event+roam` scope means "this event and the *next* roam".

### Deal

`start()` → `deal()`: drop roles (F, then E), shuffle roles to players, pick a Stowaway, render each card's text (false memory + neutral goal for the Stowaway),
pick two innocents for the engine manifest, then place objects and clues. Clues whose home cabin belonged to a dropped role are **relocated** to another free
cabin (never the subject's own). Clues about dropped roles are not placed at all.

### Socket protocol

Defined in [`shared/src/index.ts`](../shared/src/index.ts) (`ClientToServer`, `ServerToClient`).

| Client → server | Purpose |
|---|---|
| `room:create / join / rejoin / leave / kick` | seating. `join` with a disconnected player's name rejoins; `rejoin` uses a session token. |
| `game:start / ready / move / act / cancel / ask / reveal` | the game |
| `game:diningVote / finalVote / endingNext / playAgain` | ballots and endings |
| `chat:send` | proximity text |
| `voice:join / voice:signal` | WebRTC signalling relay |

The server pushes `state` (a full `GameView`) after every change (debounced to one microtask per room), plus `toast` and `kicked`.
A full snapshot per push is a few KB and removes a whole class of desync bugs.
Times are absolute server timestamps; the client keeps a clock offset (`serverNow − Date.now()`), so progress bars and timers stay in sync.

### Persistence

None, deliberately. Rooms live in memory; a restart ends every game. Rooms idle for 30 minutes with nobody connected are swept.

## 3. Client

```
client/src/
├─ main.tsx, net.ts, store.ts, voice.ts
├─ ui/       App, Screens (landing/lobby/briefing), Game (HUD + panels), Overlays (modals, ballots, ending), SceneHost, bits
├─ scene/
│  ├─ TrainScene.ts   the live 3D stage (createTrainScene) + DOM labels and hotspots
│  ├─ painters.ts     procedural painted-scenery layers + station palettes (vendored from design/style-b.html, station 5 added)
│  └─ cast.ts         the six passengers, the driver and the conductor
└─ styles.css         the case-file collage UI (cream paper, brass, oxblood, ink)
```

* **UI state** is a tiny external store (`store.ts`) read with `useSyncExternalStore`. The server `GameView` is held whole and read by components; there is no client-side game logic.
* **The scene is one persistent canvas** behind every screen (landing, lobby, briefing, game, ending). `SceneHost` calls `scene.sync(view)` on each state push, picks the camera mode, and swaps station scenery.
* **Scene art** follows the confirmed Style B: toon-shaded, ink-outlined carriages and passengers in front of painted parallax scenery at true depths. The painter code and the passengers/locomotive builders are vendored from `design/style-b.html`;
  carriages, the data-driven props, passenger movement, camera and overlays are game-specific.
  * **Props are data-driven.** Every object in `story.json` becomes a prop chosen by its `kind` and laid out by its `slot`; adding an object needs no art change.
  * **Hotspots and name labels are DOM elements** projected from 3D positions every frame (so they are crisp, accessible and easy to style).
  * **Scenery painting is lazy.** The current station is painted on load; the next is painted during the event and dinner and swapped in at the next roam; older ones are disposed. Textures are procedural: swapping in artist-painted PNG strips later is a drop-in change.
  * **Graphics and performance.** A normal frame is about 1,000 draw calls and 90k triangles, most of them the passengers' many small parts and their ink outlines.
    Shadow maps are only refreshed for the carriage on screen, each carriage has a single point light, and scenery textures use 4x anisotropy.
    The *Low gfx* toggle drops shadows, the ink outlines and the pixel ratio (about half the draw calls). The game suggests it once if the frame rate stays below about 22 fps.
    `scene.stats` (fps, draw calls, CPU time) is available from the console as `__scene.stats`.
* **Music** (`audio.ts`, `ui/Music.tsx`): generative, synthesised with Web Audio, so there are no audio files. Each scenery theme (plus title and ending) is a mood: a scale, a slow chord loop, a pad, a soft bass and a sparse random-walk bell melody through shared reverb and echo.
  The game phase is a *layer* on the same track (event and ballot go dim and tense, dinner gets warmer with a soft plucked bass), so only a station change crossfades. Volume and on/off are remembered in `localStorage`;
  music ducks while anyone is speaking. `__music.measure('forest','roam')` renders a mood offline and reports peak/RMS for level checks.
* **Voice** (`voice.ts`): a peer-to-peer WebRTC **mesh** (at most 15 connections at six players). The server relays signalling and tells clients when voice is allowed (`view.voiceAllowed`:
  on in lobby, briefing, dinner, final vote and endings; off while roaming). Clients obey by muting the local track and the remote audio elements. Public STUN only; add a TURN server if playtests fail to connect.
  Mic level and "speaking" rings come from `AnalyserNode`s. This is *advisory* enforcement: a modified client could keep talking. It is a friends playtest.

## 4. Testing

```
npm test               # vitest, server only: 53 tests, under a second
npm run typecheck      # tsc on all three workspaces
npm run validate:story # lint content/story.json
```

* `deal.test.ts`: roles, dropped roles, clue placement and relocation, templating, goal fallbacks.
* `rules.test.ts`: movement and the luggage cap, search exclusivity, the conductor, events and effects, ballots, the Stowaway pipeline, the privacy assertions, proximity chat, disconnects.
* `fullgame.test.ts`: bots play whole games for 4, 5 and 6 players through every phase (random wandering, random votes) and check the invariants (exactly one left aboard, a two-line ending per player, the truth last).

For manual testing alone, `npm run bots -- ABCD 3` adds bot passengers to a room, and `TIME_SCALE=0.2` runs the whole game five times faster.
