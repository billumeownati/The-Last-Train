import type { GameView } from '@tlt/shared';
import { net, socket } from './net';
import { ui } from './store';

/**
 * Peer-to-peer WebRTC voice mesh (up to 6 players, 15 connections).
 * The server relays signalling and decides *when* voice is allowed (`view.voiceAllowed`):
 * on in the lobby, the dining car and the final vote; forced off while roaming.
 * Clients obey by muting the local track and the remote audio elements.
 */

const ICE: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

interface Peer {
  id: string;
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  analyser?: AnalyserNode;
  stream?: MediaStream;
  pendingIce: RTCIceCandidateInit[];
  makingOffer: boolean;
}

class VoiceManager {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private peers = new Map<string, Peer>();
  private meId = '';
  private allowed = false;
  private timer: number | null = null;

  get supported() {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof RTCPeerConnection !== 'undefined';
  }

  async enable(): Promise<boolean> {
    if (!this.supported) {
      ui.set({ mic: 'unsupported' });
      return false;
    }
    if (this.stream) return true;
    ui.set({ mic: 'asking' });
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    } catch {
      ui.set({ mic: 'denied' });
      return false;
    }
    this.ctx = new AudioContext();
    void this.ctx.resume();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.localAnalyser = this.ctx.createAnalyser();
    this.localAnalyser.fftSize = 512;
    src.connect(this.localAnalyser);
    ui.set({ mic: 'on', micMuted: false });
    net.voiceJoin(true);
    this.applyMute();
    this.timer = window.setInterval(() => this.measure(), 140);
    return true;
  }

  disable() {
    net.voiceJoin(false);
    this.peers.forEach((p) => this.closePeer(p.id));
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    void this.ctx?.close();
    this.ctx = null;
    this.localAnalyser = null;
    ui.set({ mic: 'off', micLevel: 0, speaking: [] });
  }

  setMuted(m: boolean) {
    ui.set({ micMuted: m });
    this.applyMute();
  }

  private applyMute() {
    const on = this.allowed && !ui.get().micMuted;
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = on));
    this.peers.forEach((p) => (p.audio.muted = !this.allowed));
  }

  private level(an: AnalyserNode | undefined | null): number {
    if (!an) return 0;
    const buf = new Uint8Array(an.fftSize);
    an.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += ((v - 128) / 128) ** 2;
    return Math.sqrt(sum / buf.length);
  }

  private measure() {
    const loc = this.level(this.localAnalyser);
    const talking: string[] = [];
    if (loc > 0.035 && this.allowed && !ui.get().micMuted) talking.push(this.meId);
    this.peers.forEach((p) => {
      if (this.allowed && this.level(p.analyser) > 0.03) talking.push(p.id);
    });
    const cur = ui.get().speaking;
    const changed = talking.length !== cur.length || talking.some((t, i) => cur[i] !== t);
    ui.set({ micLevel: Math.min(1, loc * 6), ...(changed ? { speaking: talking } : {}) });
  }

  /** Called on every state push. */
  sync(view: GameView) {
    this.meId = view.youId;
    this.allowed = view.voiceAllowed;
    this.applyMute();
    if (!this.stream) return;
    const want = new Set(view.players.filter((p) => p.id !== view.youId && p.voiceOn && p.connected).map((p) => p.id));
    for (const id of [...this.peers.keys()]) if (!want.has(id)) this.closePeer(id);
    for (const id of want) {
      if (this.peers.has(id)) continue;
      this.openPeer(id, view.youId < id); // lower id makes the offer
    }
  }

  private openPeer(id: string, initiator: boolean) {
    const pc = new RTCPeerConnection(ICE);
    const audio = new Audio();
    audio.autoplay = true;
    audio.muted = !this.allowed;
    const peer: Peer = { id, pc, audio, pendingIce: [], makingOffer: false };
    this.peers.set(id, peer);
    this.stream!.getTracks().forEach((t) => pc.addTrack(t, this.stream!));
    pc.onicecandidate = (e) => {
      if (e.candidate) net.voiceSignal(id, { ice: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      peer.stream = e.streams[0];
      audio.srcObject = peer.stream;
      void audio.play().catch(() => undefined);
      if (this.ctx && peer.stream) {
        const an = this.ctx.createAnalyser();
        an.fftSize = 512;
        this.ctx.createMediaStreamSource(peer.stream).connect(an);
        peer.analyser = an;
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        this.closePeer(id);
        // a fresh sync will reopen it
      }
    };
    if (initiator) void this.offer(peer);
  }

  private async offer(peer: Peer) {
    try {
      peer.makingOffer = true;
      const o = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(o);
      net.voiceSignal(peer.id, { sdp: peer.pc.localDescription });
    } finally {
      peer.makingOffer = false;
    }
  }

  async onSignal(from: string, data: { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit }) {
    if (!this.stream) return;
    let peer = this.peers.get(from);
    if (!peer) {
      // an offer can arrive a moment before our own state push lists the sender
      this.openPeer(from, false);
      peer = this.peers.get(from)!;
    }
    const pc = peer.pc;
    try {
      if (data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        for (const c of peer.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => undefined);
        if (data.sdp.type === 'offer') {
          const a = await pc.createAnswer();
          await pc.setLocalDescription(a);
          net.voiceSignal(from, { sdp: pc.localDescription });
        }
      } else if (data.ice) {
        if (pc.remoteDescription) await pc.addIceCandidate(data.ice).catch(() => undefined);
        else peer.pendingIce.push(data.ice);
      }
    } catch {
      /* a glitch in negotiation: the next sync will rebuild the peer */
    }
  }

  private closePeer(id: string) {
    const p = this.peers.get(id);
    if (!p) return;
    p.pc.close();
    p.audio.srcObject = null;
    this.peers.delete(id);
  }
}

export const voice = new VoiceManager();

socket.on('voice:signal', ({ from, data }) => void voice.onSignal(from, data as never));
