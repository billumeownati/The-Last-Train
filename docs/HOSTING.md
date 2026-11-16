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
| **A cheap VPS** (Hetzner, DigitalOcean, **Oracle's Always Free VM**) | $0-5/month | yes | the long-term setup | you manage Node, a reverse proxy and https yourself (Caddy makes that easy). Step-by-step for Oracle below (Option 3). |

Prices and free tiers change; confirm on each provider's page before committing.

## Recommended path

1. **Now, for playtests:** your PC + Cloudflare tunnel (below).
2. **If friends want to play without you hosting:** deploy to Render (below).
3. **If it takes off:** move to a small VPS (Oracle's free 1 GB VM is enough: see Option 3), add a TURN server for voice, and consider persistence (see `ROADMAP.md`).

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

## Option 3: an Oracle Cloud "Always Free" VM (1 GB)

A single room of six players made the server use about 140 MB of RAM in testing, so the 1 GB free machine is plenty to *run* it. The tight spots are **building** the client (use swap) and **https** (needed for voice).
Commands below assume **Ubuntu** (22.04 or 24.04). Replace `YOUR-USER/the-last-train` with your repo.

### 1. Create the VM

* Shape: the free **AMD micro** (`VM.Standard.E2.1.Micro`, 1 GB). If your account can get an **Ampere A1 (ARM)** shape, it has far more room, but free capacity for it is often unavailable.
* Image: Ubuntu. Add your SSH key. Note the **public IP**.
* If you will use your subdomain with Caddy (step 6a): in the VM's subnet **Security List** (Networking → Virtual Cloud Networks → your VCN → subnet → Security Lists) add **Ingress Rules** for TCP **80** and **443** from `0.0.0.0/0`.
  If you will use a Cloudflare tunnel (step 6b), you can skip this: the tunnel makes an outbound connection only.

### 2. Install Node, git and swap

```bash
ssh ubuntu@YOUR_IP

# Node 22 LTS + git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

# 2 GB swap so that `npm run build` doesn't run out of memory on 1 GB
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

### 3. Get the code and build it

```bash
git clone https://github.com/YOUR-USER/the-last-train.git
cd the-last-train
npm install --include=dev      # dev dependencies (Vite, TypeScript) are needed to build the client
npm run build                  # writes client/dist
```

No GitHub repo? Build on your PC and copy it up instead: `npm run build` locally, then `scp -r . ubuntu@YOUR_IP:~/the-last-train` (skip `node_modules`; run `npm install --omit=dev` on the VM).

### 4. Run it as a service

Create `/etc/systemd/system/lasttrain.service` (use `sudo nano`):

```ini
[Unit]
Description=The Last Train game server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/the-last-train
Environment=PORT=3000
Environment=HOST=127.0.0.1
ExecStart=/usr/bin/node node_modules/tsx/dist/cli.mjs server/src/index.ts
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

`HOST=127.0.0.1` keeps the game port private: only Caddy or the tunnel on the same machine can reach it.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lasttrain
curl -s http://127.0.0.1:3000/healthz        # {"ok":true,"rooms":0}
journalctl -u lasttrain -f                   # live logs (Ctrl+C to leave)
```

### 5. Check memory

```bash
free -h
ps -o rss,cmd -C node          # RSS is in KB; expect roughly 70,000 to 150,000 per process
```

### 6. https (microphones need it): pick one

**6a. Your own subdomain with Caddy** (automatic certificates, handles WebSockets for you). This guide uses `lasttrain.debz.in`; any subdomain you control works the same way.

1. **Point the subdomain at the VM.** In your DNS provider add an **A record**: name `lasttrain` (so it becomes `lasttrain.debz.in`), value = the VM's public IP. If the DNS is on Cloudflare, set the record to **DNS only** (grey cloud) so Caddy can get its certificate directly; you can switch to proxied later if you want to (then set Cloudflare's SSL mode to *Full (strict)*).
   Check it has propagated before the next step: `nslookup lasttrain.debz.in` should print the VM's IP.
2. **Open ports 80 and 443** in two places (step 1 did the cloud Security List). Oracle's Ubuntu images also block ports inside the VM:

   ```bash
   sudo iptables -I INPUT 1 -m state --state NEW -p tcp --dport 80  -j ACCEPT
   sudo iptables -I INPUT 1 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save     # if missing: sudo apt-get install -y iptables-persistent
   ```

3. **Install and configure Caddy.** Caddy needs port 80 reachable to obtain and renew the certificate.

   ```bash
   sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt-get update && sudo apt-get install -y caddy

   echo 'lasttrain.debz.in {
       reverse_proxy 127.0.0.1:3000
   }' | sudo tee /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   sudo journalctl -u caddy -n 30 --no-pager     # look for "certificate obtained successfully"
   ```

4. **Open `https://lasttrain.debz.in`** and `https://lasttrain.debz.in/healthz`. If the certificate fails: DNS has not propagated yet, or port 80 is still blocked (re-check both firewalls), or the Cloudflare record is proxied while SSL mode is wrong.

**6b. A Cloudflare tunnel** (no domain, no open ports).
Install `cloudflared` from Cloudflare's downloads page for your CPU (amd64 for the micro shape, arm64 for Ampere), then:

```bash
cloudflared tunnel --url http://127.0.0.1:3000
```

It prints an `https://….trycloudflare.com` address. That quick tunnel changes every time and stops when you close the session. For a permanent address you need a (free) Cloudflare account with a domain on it and a *named* tunnel
(follow Cloudflare's "Create a locally-managed tunnel" guide, then run it as a service).

### 7. Updating

```bash
cd ~/the-last-train
git pull
npm install --include=dev
npm run build
sudo systemctl restart lasttrain
```

Restarting ends every game in progress (rooms live in memory), so update between sessions.

### Things to know

* **Keep it to one process.** Don't start a second copy for "more capacity": rooms live in one process's memory.
* **The micro shape has a small slice of one CPU.** That is plenty for the game (it does very little work per room), but `npm install` and `npm run build` will be slow. Be patient, or build on your PC.
* **Idle reclaim.** Oracle may reclaim Always Free instances that stay nearly idle for an extended period, and its free-tier terms change. Read the current Always Free rules, and keep a backup of `content/story.json` and anything you've customised.
* **Voice** still needs STUN/TURN to cross some networks; the server relays only the handshake. See "Voice (WebRTC)" below.
* **Don't expose the game port directly.** Keeping `HOST=127.0.0.1` behind Caddy or the tunnel avoids serving plain http to the world.

## Voice (WebRTC) wherever you host

Voice is peer-to-peer between players' browsers. The server only relays the handshake, so hosting has no bandwidth cost for voice.
It needs **https** (tunnels and Render provide it) and works through most home networks with the free public STUN servers already configured.
Players behind strict networks (some offices, schools or mobile carriers) may not connect. Fix: add a **TURN** server to `ICE` in `client/src/voice.ts`
(managed TURN services have free tiers, or run `coturn` on a VPS).

## One server, one process

Rooms are stored in the memory of a single process, so **do not scale to multiple instances** (players in the same room must reach the same process).
One small instance comfortably handles many rooms: a room is a few KB of state and a handful of sockets.
