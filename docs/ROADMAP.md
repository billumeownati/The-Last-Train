# Roadmap

v1 is a friends playtest. Everything below is **deliberately deferred** until a playtest says the core game is fun.

## Next (if v1 playtests are good)

* **Tune from playtest notes.** Timings (`TIMING` in `shared/src/index.ts`), hint ambiguity, ballot options, clue density. See `PLAYTEST-GUIDE.md`.
* **TURN server** for voice, if peer-to-peer connections fail for some players.
* **Sound effects:** train rumble, wheel clacks, the conductor's whistle, a different stinger per event, a vote chime. (Mild generative music per station is already in v1; the scene has a train speed value that can drive pitch.) Composed or licensed music could replace the generated tracks per station.
* **Painted art.** Station scenery is procedural; each layer is a slot that an artist's PNG strip can replace with no code change. The passengers and carriages stay 3D.
* **More stories.** The game reads one JSON file. A second backstory needs only a new file; if it also needs new carriages or props, the object `kind` list in the scene is the extension point.

## Later

* **Per-carriage proximity voice.** v1 voice is on or off per phase. Proximity voice would let people overhear conversations in the same carriage during Roam. The server already knows who is in which carriage.
* **Accounts, friends lists, matchmaking.** v1 uses 4-letter room codes and names only.
* **Mobile and tablet layouts.**
* **Spectators, replays, a post-game timeline** of who found what and when.
* **Optional house rules:** a knowing Stowaway; shorter phases; fewer stations for a 30-minute game; a second Stowaway at 6 players.
* **Reconnect hardening:** keeping a seat across server restarts (needs persistence).

## Known rough edges in v1

* Passengers do not animate their limbs, only walk and bob.
* The in-car camera is fixed per carriage; there are no manual camera controls beyond the *Whole train* toggle.
* Searching an object is a single click; there is no hold-to-search.
* Clue text is plain; there are no images for clues.
* The ending is text-and-stamps over the scene; there is no cinematic.
