# Content guide: editing the story

The entire backstory is one file: [`content/story.json`](../content/story.json). It is **data, not code**. Edit it, run the validator, restart the server.

```bash
npm run validate:story      # errors block the server from starting; warnings are advice
```

Use `STORY_PATH=path/to/other.json` to point the server at a different story file.

## What is in it

| Section | Count | Purpose |
|---|---|---|
| `meta` | | title, tagline, the shared premise (with `{count}` and `{off}`), the briefing tip |
| `stations` | 5 | name, scenery `theme` (`forest`, `flood`, `burning`, `snow`, `dark`), blurb |
| `roles` | 6 | the cards: memory, false memory, lie, goal, conductor lines, epilogues |
| `stowaway` | 1 | neutral goal, truth, hints and red herrings, conductor lines, epilogues, the reveal |
| `objects` | ~35 | everything that can be searched, and where it sits |
| `clues` | ~30 | the evidence and which object holds it |
| `events` | 5 | one per station, with a mechanical effect and a "worse" variant |
| `visions` | 5 | one per station, seen at the viewing glass |
| `conductor` | | his route, his answers, tie-break line |
| `diningVotes` | 4 | the ballot options for stations 1 to 4 |
| `finalVote` | | the prompt |

## Roles

```jsonc
{
  "id": "A", "character": "fedora",          // A..F. character picks the 3D passenger (fedora, cloche, bowler, flatcap, widebrim, tophat)
  "name": "Walter Hale", "short": "Hale", "title": "The Reporter", "blurb": "…",
  "memory":      "What you believe happened. True.",
  "falseMemory": "What this role believes if they are the Stowaway. Must contradict the truth and be disprovable.",
  "lie":         "A claim the player has agreed to make. Do NOT make it match the false memory.",
  "goal": { "kind": "leaveBehind", "target": "D", "text": "…" },
  "board": "Conductor's answer to 'Where did I board?'",
  "who":   "Conductor's answer to 'Who is this person?' about this role.",
  "epilogues": { "leftWin": ["line 1","line 2"], "leftLose": ["…"], "stayed": ["…"], "stayedWin": ["…"] }
}
```

* **Goal kinds:** `getOff`, `leaveBehindStowaway`, `leaveBehind` (+`target`), `keepTogether` (+`target`), `stayBehind`. If `target` is not in play the goal falls back to `getOff`.
* `epilogues.stayedWin` is only used for a player whose goal is `stayBehind`.
* Epilogues are **two lines** each, melancholic and not graphic.

### Role placeholders

Anywhere text can mention a role: `{E}` is the role's full name, `{E:short}` the short name. **If that role is not in play** (4 or 5 players), it renders as
*"a passenger who got off at an earlier stop"* (capitalised at a sentence start). **Never** write `{E}'s`: the possessive breaks when it falls back.

### Design rules that make the deduction work

* **Memories name neighbours.** Each true memory says who sat beside you. The six memories together form a consistent seat plan; each *false* memory contradicts it. That is what lets players catch a Stowaway by comparing recollections.
* **Every role gets two lie clues:** one in a hard spot (luggage van or observation car), one in *another player's cabin*. Clues must be **true statements**; they never name the Stowaway.
* **Every role gets a memory clue** that confirms one true detail (and so disproves the false memory).
* **A lie must not coincide with the false memory.** Otherwise the Stowaway would be telling the truth.
* Keep red herrings plausible: an innocent who receives a "no nameplate" hint should not feel accused.

## Dropping roles (4 and 5 players)

Roles drop in a **fixed order: F, then E.** Dropped roles' objects (their cabins) and clues disappear.
Clues that were hidden in a dropped cabin are **moved to another free cabin** (never the subject's own).
Therefore:

* Roles **A to D must be playable alone.** Don't aim a goal at E or F from A to D, or you will get a validator warning (it falls back to `getOff`).
* Keep at least two options per ballot that don't depend on a dropped role. (`openLocked` on an empty container is dropped automatically; the server always keeps at least two options.)
* A role's lie/memory clues should not be the *only* route to some truth.

## Objects

```jsonc
{ "id": "lug-trunk-1", "carriage": "luggage", "label": "Steamer trunk", "kind": "trunk", "slot": 0,
  "from": 3,         // first station (1-5) at which it can be searched; default 1. Paces discovery.
  "locked": true,    // opened only by a dining ballot ('openLocked')
  "hidden": true,    // appears only when an event spawns it
  "owner": "C",      // sleeper-car objects only: whose cabin
  "empty": "Flavour text shown if there is nothing inside." }
```

* `kind` chooses the 3D prop and the ring height: `trunk crate bag shelf drawer lockbox window lantern cabinet bunk desk coat device`.
  Exactly one object per game should be `kind: "window"`: it is the **viewing glass** (a vision, 10 s, non-exclusive).
* `slot` is the position along the carriage (0 = rear end). Luggage and observation fit 8 and 7 slots; the engine 3; sleepers' slots are the cabin number (0 to 5 = roles A to F).
* One clue per object at most.
* **Pacing with `from`.** Aim for roughly 6 clue-bearing objects becoming available per station for six players (there are tests that check every station has at least two).
  Remember the events: the Sleeper Car goes dark for event 1 and roam 2, the luggage van floods for event 2 and roam 3, the engine only opens at event 4.
  Put clues in a carriage *before* the event that closes it, or after.

## Clues

```jsonc
{ "id": "c-A1", "type": "lie", "role": "A", "object": "obs-desk", "title": "A press card", "text": "…" }
```

* `type`: `lie`, `memory`, `truth`, `engine`, `event`. `lie` and `memory` need a `role`.
* The engine manifest uses `{legit1}` and `{legit2}`: two roles proven innocent (never the Stowaway).
* `object` is its home. If that is a sleeper object of a dropped role, it is moved automatically.

## Events

```jsonc
{ "station": 2, "title": "…", "text": "…",
  "effects": [ { "type": "closeCarriage", "carriage": "luggage", "scope": "event+roam" } ],
  "worse": { "text": "Because nobody chose…", "effects": [ { "type": "slowWalk", "factor": 1.5, "scope": "event+roam" } ] } }
```

Effect types: `lockSearch` (carriage), `closeCarriage` (carriage), `unlockCarriage` (engine), `spawnObject` (a `hidden` object), `slowWalk` (factor), `slowSearch` (factor),
`blackout`, `lockVision`, `confirmStowaway`. `scope` is `event` (just the one-minute event) or `event+roam` (also the next Roam).
`worse` is applied when the previous dinner's ballot was skipped; event 1 has none.

## Dining ballots

```jsonc
{ "id": "2b", "kind": "confine", "target": "random", "text": "Lock {target} in their cabin for the next leg." }
```

* `kind`: `openLocked` (`target` = a locked object id), `searchSuitcase`, `confine` (`target` = a role id or `"random"`), `shiftLuggage` (no target).
* `{target}` renders as *"Character Name (Player Name)"*. Phrase options as "the suitcase of {target}", not "{target}'s".
* **Do nothing** is always offered by the game and is not in the file.

## Stowaway hints

```jsonc
"hints": [ { "station": 1, "text": "Your cabin door has no nameplate.", "redHerrings": ["The plate on your door is crooked."] },
           { "station": 4, "confirmation": true, "text": "The conductor stops beside you…" } ]
```

One real hint per station goes to the Stowaway; each station's red herrings go to up to two random innocents (about 45% chance each).
Make the red-herring wording similar enough that it does not instantly clear the recipient.

## Checklist before a playtest

1. `npm run validate:story` shows **0 errors**.
2. Play it at **4, 5 and 6 players** (the bots help: `npm run bots -- CODE 3`).
3. Read every clue aloud: does it assume a specific role is in play?
4. Can the Stowaway of each role be disproved by *at least two* routes (one clue, one other player's memory)?
5. Is every lie contradicted by two clues, one of which is *not* in the liar's own cabin?
