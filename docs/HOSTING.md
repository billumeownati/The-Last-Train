# Where to host The Last Train

**Short answer:** not Vercel. For a friends playtest, **run it on your own PC and share a Cloudflare tunnel link** (free, takes two minutes).
If you want a link that works when your PC is off, use **Render** (free tier, sleeps when idle) or a small always-on server.

## Why not Vercel (or Netlify, Cloudflare Pages)

The Last Train is **one long-running Node process** that holds every room in memory and keeps a live WebSocket open to each player.
Vercel's free plan runs *serverless functions*: short-lived, stateless, and they cannot hold a WebSocket open or share memory between requests.
The game would not work there, whatever the plan.

You *could* put only the static client on Vercel and the server elsewhere, but it gains nothing: the server already serves the client, and splitting them adds CORS and a second deployment to maintain.

## Options

| Option | Cost | Always on? | Good for | Notes |
|---|---|---|---|---|
| **Your PC + Cloudflare tunnel** | free | only while your PC runs it | playtests with friends | https included, so microphones work. No account needed for a quick tunnel. |
| **Render** (web service) | free tier | sleeps after ~15 min without traffic; ~30-60 s cold start | a shareable link that isn't tied to your PC | supports WebSockets and https. Rooms are lost when it sleeps or redeploys. |
| **Railway / Koyeb / Fly.io** | small credit or a few $/month | yes | a more permanent home | free allowances change often. Check their current pricing page. |
| **A cheap VPS** (Hetzner, DigitalOcean, Oracle's always-free VM) | $0-5/month | yes | the long-term setup | you manage Node, a reverse proxy and https yourself (Caddy makes that easy). |

Prices and free tiers change; confirm on each provider's page before committing.

## Recommended path

1. **Now, for playtests:** your PC + Cloudflare tunnel (below).
2. **If friends want to play without you hosting:** deploy to Render (below).
3. **If it takes off:** move to a small VPS, add a TURN server for voice, and consider persistence (see `ROADMAP.md`).

## Option 1: your PC with a Cloudflare tunnel

```bash
npm install
npm run play                                   # http://localhost:3000
cloudflared tunnel --url http://localhost:3000 # prints https://something.trycloudflare.com
```

Send that address to your friends. Keep both windows open for the whole game. The address changes each time you start the tunnel.

## Option 2: Render

The server serves the built client, so it is a single web service.

1. Push this repo to GitHub.
2. In Render: **New → Web Service**, pick the repo.
3. Settings:
   * **Build command:** `npm install --include=dev && npm run build`
     (`--include=dev` matters: Vite and TypeScript are dev dependencies and are needed to build the client.)
   * **Start command:** `npm start`
   * **Health check path:** `/healthz`
   * **Instance type:** Free to start.
4. Environment: nothing required. `PORT` is provided by Render. Optional: `TIME_SCALE` (leave unset for real time).
5. Open the `https://…onrender.com` address. The first load after idle takes a while (the free instance wakes up).

Things to know on a free tier:
* **Rooms live in memory.** If the instance sleeps or you redeploy, every room is lost. Don't deploy in the middle of a game.
* **Cold start:** the first visitor waits while it wakes. Open the link yourself a minute before everyone joins.
* An active game keeps traffic flowing, so it should not sleep mid-game, but an idle lobby can.

## Voice (WebRTC) wherever you host

Voice is peer-to-peer between players' browsers. The server only relays the handshake, so hosting has no bandwidth cost for voice.
It needs **https** (tunnels and Render provide it) and works through most home networks with the free public STUN servers already configured.
Players behind strict networks (some offices, schools or mobile carriers) may not connect. Fix: add a **TURN** server to `ICE` in `client/src/voice.ts`
(managed TURN services have free tiers, or run `coturn` on a VPS).

## One server, one process

Rooms are stored in the memory of a single process, so **do not scale to multiple instances** (players in the same room must reach the same process).
One small instance comfortably handles many rooms: a room is a few KB of state and a handful of sockets.
