# Playtest guide

**v1 exists to answer one question: does a group finish a game and want another?**
Keep the first sessions casual. Fix only what blocks that.

## Hosting a session

One person runs the server; everyone else just opens a link.

```bash
npm install            # once
npm run play           # builds the client, then serves everything on http://localhost:3000
```

The game needs **https** for microphones when played over a network (browsers only allow `getUserMedia` on https or `localhost`).
The easiest way is a free Cloudflare quick tunnel to your local server:

```bash
cloudflared tunnel --url http://localhost:3000
```

It prints an `https://something.trycloudflare.com` address. Send it to your friends. They open it, type a name and the **4-letter room code** (or use the *Copy invite link* button in the lobby).
If you play on the same wifi you can instead share `http://<your-LAN-ip>:3000`, but voice will not work there without https.

Hosting somewhere that is not your PC? See [`HOSTING.md`](HOSTING.md).

Everyone should use **desktop Chrome or Firefox** and **headphones** (there is no echo cancellation beyond the browser's own).

## A session, step by step

1. Host opens the page, **Host a train**, and shares the code. 4 to 6 players. Everyone does the **mic check** in the lobby.
2. Host presses **Start the journey**. A **60 s briefing**: read your card in private. Don't show it to anyone.
3. Five stations of **Roam (3 min) → Event (1 min) → Dinner (3 min)**. About **45 minutes** in total.
4. **Final vote**, then the endings are revealed one by one. The host can press *Next* to skip ahead and *Play again* when it is done.

Tips for the group: talk at dinner (voice is *forced off* while roaming; use the carriage text chat); show a real clue by pressing **Show to the table**;
walk to the Dining Car early; ask the conductor your one question.

## Solo and small-group testing

```bash
npm run dev:fast                  # server + Vite dev client with every timer five times faster
npm run bots -- ABCD 3            # in another terminal: three bot passengers join room ABCD
```

* Bots wander, search, ask the conductor, chat and vote at random. They are noisy and they find everything quickly, which makes them a good stress test.
* `TIME_SCALE` accepts any number: `TIME_SCALE=0.1 npm start` is ten times faster. The client shows the scaled timers, so everything stays consistent.
* `PORT=3001 npm start` changes the port. For the dev client, Vite runs on **5173** and proxies the socket to **3000**.

## What to watch for

Take notes during or right after. Don't fix things mid-session.

**Fun**
* Did the table argue at dinner, or sit silent? When did people start talking?
* Did anyone say "wait, that doesn't match what you said"? (That is the core loop working.)
* Did the Stowaway player enjoy it? Did they feel lost, or sneaky?
* Did the final vote feel earned, or random?

**Pacing** (the knobs are `TIMING` in `shared/src/index.ts`)
* Roam too long or too short? Did people run out of things to search?
* Did the ballot options matter?
* Was dinner long enough to talk everything through?

**Clarity**
* Could people tell what to click? Did they find the glowing rings, the conductor, "Show to the table"?
* Did anyone not realise they could ask the conductor a question?
* Did the red herrings read as hints, or as noise?

**Technical**
* Did voice connect for everyone? (If not, you probably need a TURN server: see below.)
* Did anyone lose connection? Did rejoining by **room code + name** work?
* Frame rate on the slowest laptop. The **Low gfx** button is in the top bar.

## Known limits of v1

* **Music** starts after the first click (browsers block audio before that). Each player controls their own volume from the *Music* button; it ducks while someone is talking.

* **Voice is a peer-to-peer mesh with public STUN only.** Behind strict NATs (some corporate or mobile networks) it can fail. If it does, add a TURN server to `ICE` in `client/src/voice.ts`.
* **Forced-off voice is advisory.** The server decides when voice is allowed; clients mute themselves. A modified client could keep talking while roaming.
* **No persistence.** If the server restarts, the game is gone.
* **Desktop only.** Phones and tablets are out of scope.
* **The first scene takes a few seconds to paint** on load (it is generated in the browser). The next station is painted in the background during dinner.

## After the session

Ask everyone:

1. Would you play again tomorrow? Next week? Never?
2. Who did you think the Stowaway was, and when did you change your mind?
3. What was the single most confusing moment?
4. What was the best moment?

Write the answers down next to the room's story version. Tune `content/story.json` first (it is the cheapest lever), the ballot options second, timings third.
