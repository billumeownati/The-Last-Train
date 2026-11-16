import { ROOM_CODE_LEN } from '@tlt/shared';
import type { Story } from './content.js';
import { Room, type RoomDeps } from './game/room.js';

// No I or O: they read as 1 and 0 when a friend shouts the code over voice chat.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export interface RoomEntry {
  room: Room;
  /** playerId -> socket id */
  sockets: Map<string, string>;
}

export class RoomRegistry {
  private rooms = new Map<string, RoomEntry>();

  constructor(
    private story: Story,
    private timeScale: number,
    private hooks: { onChange: (code: string) => void; onToast: (code: string, playerId: string, kind: 'info' | 'error', text: string) => void },
    private makeDeps: () => Partial<RoomDeps> = () => ({}),
  ) {}

  get(code: string): RoomEntry | undefined {
    return this.rooms.get(code);
  }

  all(): RoomEntry[] {
    return [...this.rooms.values()];
  }

  create(): RoomEntry {
    let code = '';
    do {
      code = Array.from({ length: ROOM_CODE_LEN }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
    } while (this.rooms.has(code));
    const room = new Room(code, {
      story: this.story,
      timeScale: this.timeScale,
      onChange: () => this.hooks.onChange(code),
      onToast: (pid, kind, text) => this.hooks.onToast(code, pid, kind, text),
      ...this.makeDeps(),
    });
    const entry: RoomEntry = { room, sockets: new Map() };
    this.rooms.set(code, entry);
    return entry;
  }

  /** Drop rooms nobody has been in for a while. */
  sweep(idleMs: number, now = Date.now()) {
    for (const [code, e] of this.rooms) {
      const anyoneConnected = e.room.players.some((p) => p.connected);
      if (!anyoneConnected && now - e.room.lastActivityAt > idleMs) this.rooms.delete(code);
    }
  }

  get size() {
    return this.rooms.size;
  }
}
