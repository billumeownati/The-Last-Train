# The Last Train: Game Design (v1, as built)

This is the rulebook the code implements. It settles the contradictions in the original pitch.
If the game and this document disagree, that is a bug in one of them. Please fix it.

**One line:** a browser social-deduction game on a night train. Four to six friends ride through the memory of a car crash.
One of them does not belong. At the last stop, all but one of them step down.

**v1 goal:** a friends-only playtest. Success means a group finishes a game and wants another.
No accounts, no matchmaking, no database. Room codes only.

---

## 1. The story in one paragraph

On the night of 14 November 1936 a green Packard left Harrow Hall for the last train at Harrow Junction. It never arrived.
Six people were in it. Now they ride a train on no timetable, through five stretches of that night: a forest, a flooded ford,
a burning city, a snowbound pass, and a dark platform. The conductor's rule: at the Last Platform, all but one may step down.
Someone must stay. And one passenger is not who they believe they are: the Stowaway, the signalman who stood on the bridge.

Tone is melancholic and eerie, never graphic. The full backstory lives in `content/story.json` (see `CONTENT-GUIDE.md`).

## 2. Players and the cast

* **4 to 6 players.** The story is written for six roles. For fewer players, roles are dropped in a fixed order: **F (Dr. Vale) first, then E (Cora Vance)**.
  Their cabins, their lie and memory clues, and any goals that point at them go with them.
  Clues and cards that mention a dropped role say *"a passenger who got off at an earlier stop"*.
* Roles are dealt at random. Each role is a fixed 1930s fashion-plate character in the art:

| Role | Character | Art | Goal |
|---|---|---|---|
| A | Walter Hale, the Reporter | Fedora, camel trench | Leave the **Stowaway** behind |
| B | Imogen Marsh, the Pianist | Cloche, plum coat | Get off **together with Ashby (D)** |
| C | Lucian Pryce, the Banker | Bowler, pinstripe | Leave **Hale (A)** behind |
| D | Tobias Ashby, the Driver | Flat cap, tweed | Just **get off** |
| E | Cora Vance, the Singer | Wide brim, oxblood gown | **Be the one who stays** (cannot vote for self) |
| F | Dr. Edmund Vale, the Surgeon | Top hat, navy tails | Leave **Ashby (D)** behind |

## 3. Cards

Every player is dealt three things, privately, and sees a 60-second briefing:

* **Memory.** What you believe happened that night. True, unless you are the Stowaway (see section 9).
  Each memory names who sat beside you, so the six true memories fit together like a seating plan.
* **Lie.** A false claim you have agreed to make. Each lie has two contradicting clues in the world (section 6).
  Being caught lying does **not** make you the Stowaway; everyone lies about something.
* **Goal.** Evaluated when the last vote is counted (section 10).

## 4. The shape of a game

Five **stations**. Each is:

| Phase | Length | What happens |
|---|---|---|
| **Roam** | 3 min | Walk between carriages, search objects, ask the conductor, see visions. Voice is **forced off**. Text chat is per carriage. |
| **Event** | 1 min | A scripted event with a real mechanical effect fires. Hints are delivered. Movement and searching continue (under the event's effect). Voice off. |
| **Dinner** | 3 min | Everybody is called to the Dining Car. Voice is **on**. Talk, describe or show clues. The last 20 seconds are a secret ballot (stations 1 to 4). Station 5's dinner leads into the final vote. |

Before station 1 there is a **60 s briefing** (private card, shared premise, mic check). After station 5 there is a **60 s final vote**, then the endings.

Any phase except the ballots ends early if every connected player presses **Ready**. A ballot closes a few seconds after every connected player has voted,
so a vote can still be changed in that window.

All timings are constants in `shared/src/index.ts`. The server can scale every duration with the `TIME_SCALE` environment variable
(`0.2` = five times faster) for testing.

## 5. The train

Five carriages in a fixed order, front to back:

```
Engine ─ Observation ─ Dining ─ Sleepers ─ Luggage
```

* **Movement:** to an *adjacent* carriage only; about 2 seconds, shown in transit (the passenger walks the gangway on screen). Nobody can walk, search or chat while in transit.
* **Engine:** locked until the station 4 event. (Anyone inside when it is shut is shooed out.)
* **Luggage van:** two passengers at a time. People already walking in count against the limit.
* **Sleepers:** one cabin per player, with a brass nameplate. Everyone starts station 1 here.
* **Dining:** the dinner room. All talk happens here.
* **Observation:** a lounge with a *viewing glass* (visions, section 7).
* The train's carriage layout is public. Everyone can see where everyone is. *What* people are doing is only visible to others in the same carriage.

## 6. Searching and clues

* About **30 clues** are hand-placed in about 35 objects. Click a glowing ring to search it: **5 seconds**, visible to everyone in that carriage (your avatar shows a progress bar and "searching").
* **The finder takes the clue; it is exclusive.** If two people search the same object, whoever finishes first gets it. Once an object is searched it stays searched.
* Clues come in types:
  * **Lie clues (12).** Each lie has two contradicting clues: one in a hard spot (luggage van or observation car) and one in *another player's cabin*. Nothing is exposed automatically.
  * **Memory clues (6).** Each proves one true memory, and so disproves the matching false memory.
  * **Truth clues (10).** Scene-setting evidence about the crash and the stranger on the bridge.
  * **Engine manifest (1).** A torn page naming **two confirmed-innocent players** (never the Stowaway).
  * **Event clue (1).** The stranger's suitcase, which appears at station 3.
* Your clues are yours alone. In the **Dining Car** you may **describe** a clue (you may lie) or press **Show to the table** to lay the *real* card down for everyone there.
* **Locked objects** (3 of them) cannot be searched until a dining ballot opens them.
* **The train remembers more as it goes.** Every object has a first station (`from` in the story file) from which it can be searched; before that it is scenery with no glowing ring.
  This spreads about 30 clues over the whole journey (roughly 6 new things at each of the first four stations) instead of letting a group strip the train in the first roam.
  It also respects the events: the sleeper car holds its first clues before the lights fail, the luggage van's are timed around the flood, and the engine's manifest only exists once the engine is unlocked.
  When everyone has found what there is to find, the group can press **Ready** and move on early.

## 7. The conductor, visions, events

**The conductor** is an NPC who walks one carriage per Roam (dining, sleepers, observation, luggage, engine) and sits in the dining car at dinner.
When he is in your carriage you may ask **one question per station** from a fixed menu. Answers are cryptic but true, and private:

1. *Where are we going?* (a line per station)
2. *Who is this person?* (pick a passenger; a line per role)
3. *What is in that carriage?* (pick a carriage)
4. *Where did I board?* (a line per role; the **Stowaway** hears *"I don't have you on my list"*; an innocent sometimes hears a **red-herring** version)

He also breaks ties, delivers Stowaway hints and announces events.

**Visions.** Stand at the viewing glass for **10 seconds** to see that station's vision. Visions are non-exclusive (everyone can have them) and half-truths ("a figure").

**Events** (one per station, with a real mechanical effect):

| # | Event | Effect |
|---|---|---|
| 1 | The Lights Fail | Nothing in the Sleeper Car can be searched, this event and next Roam |
| 2 | The Luggage Van Floods | Luggage van shut, this event and next Roam |
| 3 | A Stranger's Suitcase | A new searchable suitcase appears in the Observation Car |
| 4 | The Engine Unlocks | Engine opens permanently. The conductor confirms the Stowaway privately. |
| 5 | The Train Slows | Walking is 1.5x slower during the event |

If the previous dinner's ballot was skipped, the event is **worse** (extra slowdowns, frost on the viewing glass, a sealed van; defined per event in the story file).

## 8. The dining ballot (stations 1 to 4)

Two or three options per station, chosen from the story file, plus an implicit **Do nothing**.
Secret ballot for 20 seconds; only the tally is shown, not who voted for what. Ties are broken at random by the conductor.

| Option type | Effect |
|---|---|
| **Open a locked compartment** | Unlocks one locked object so it can be searched |
| **Search someone's suitcase** | That player must show the table **one clue they hold** (their choice; the conductor picks after 30 s) |
| **Shift the luggage** | The unclaimed clues in the luggage van are reshuffled into new objects, and those objects can be searched again |
| **Confine someone** | That player is locked in their cabin for the next Roam. They may search only their own cabin. |

**Do nothing** (or an empty ballot) means **the next event gets worse.**
The tally is shown for a few seconds before the train moves on.

## 9. The Stowaway

The Stowaway is the single antagonist, and **they do not know it** at the start. (This was a deliberate choice: an unaware Stowaway is more interesting than a knowing one.)

* Everyone is told a Stowaway exists. Nobody knows who, including the Stowaway.
* Their card **looks identical**. Their **memory is false** (it contradicts the backstory and can be disproved by evidence and by other players' true memories). Their goal is neutral: **Get off the train.**
  They keep their role's lie, so catching someone lying is not proof.
* **One private hint per station**, delivered at the start of the event: your cabin door has no nameplate; the conductor checks his list and frowns; a vision you cannot have seen; a lamp lit for seven.
  **Innocent players sometimes receive red-herring versions**, so receiving a hint is not self-incriminating.
* **Station 4:** the conductor privately confirms the identity to the Stowaway ("You are the Stowaway") and tells them who they really are. From then on they know, and may deceive.
* **Win:** the Stowaway wins if they get off the train (someone else is left behind).
* The Stowaway's identity never leaves the server until the ending.

## 10. The last vote and the endings

* Everyone gets off **except one**. **Secret ballot** on who stays aboard. **No self-votes.**
* Most votes stays. **Ties are broken at random** (the conductor draws a ticket from his cap), only among the tied.
* The **tally is shown, then endings are revealed one by one**: first who stayed, then each passenger (who stepped down first, the one left aboard last), then the truth about the Stowaway.
* Each player's ending shows whether they stepped down, whether their **goal was met**, and a **two-line epilogue**.

**Goal kinds:**

| Kind | You win if... |
|---|---|
| `getOff` | you are not the one left behind |
| `leaveBehindStowaway` | you step down **and** the Stowaway is the one left behind |
| `leaveBehind` (role) | you step down **and** that role's player is left behind |
| `keepTogether` (role) | you step down **and** that role's player steps down too |
| `stayBehind` | you are the one left behind |

If a goal's target role is not in play (4 or 5 players), the goal falls back to `getOff`.

## 11. Disconnects and edge cases

* **A dropped player's character falls asleep in their cabin.** They can rejoin with the **room code and the same name** (or automatically, by session token). Votes missed while away count as abstentions.
* **Missing at the final vote:** the server waits up to 45 seconds for a late return. After that the missing player **automatically stays aboard and cannot win**. If anyone is missing, the ballot is not needed: the missing player or players are the ones left behind.
* **The host drops:** host duties pass to the next connected player (in join order).
* **In the lobby**, a player who is away for over 45 seconds is removed.
* **Play again** (host only): back to the lobby with everyone still seated; new roles and clues are dealt.

## 12. What is deliberately **not** in v1

Mobile, accounts, matchmaking, proximity voice (v1 voice is all-or-nothing by phase), painted artist art, sound effects (v1 has mild generative music only), more than one story,
spectators, replays, anti-cheat beyond server-side secrecy. See `ROADMAP.md`.
