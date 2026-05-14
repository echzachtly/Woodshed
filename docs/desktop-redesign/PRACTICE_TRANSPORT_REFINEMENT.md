# Practice Transport Refinement

## Goal

Refine the desktop transport bar so it feels like a deliberate practice control surface, not a generic audio player toolbar.

Woodshed is not Spotify, VLC, or a DAW.

Woodshed is a repetition-focused practice tool.

The transport should support that.

---

## Core Insight

In Woodshed, Restart may be used as often as — or more often than — Play/Pause.

A user practicing a phrase will constantly want to restart the phrase, replay a difficult section, or immediately return to the beginning of the active loop.

Therefore, Restart should be treated as a primary practice action, not a secondary text button.

---

## Transport Philosophy

The transport bar should contain controls related to:

- playback

- repetition

- practice flow

- active phrase actions

- speed

The transport bar should NOT contain viewport utilities.

---

## Remove Fit All From Transport

Remove `Fit All` from the transport bar.

Fit All is useful, but it is a viewport/navigation utility, not a playback or practice control.

It should not live in the transport cluster.

---

## Fit All Replacement

Implement Fit All through minimap interaction.

Preferred behavior:

- Double-click the minimap to fit/reset the waveform view to the full song or current intended overview state.

If needed, add a subtle tooltip or helper text near the minimap:

`Double-click to fit all`

Avoid adding a prominent new button.

---

## Restart Control Redesign

Remove the standalone `To Start` / `Restart` text button from the transport bar.

Replace it with a visual restart/retrigger affordance grouped directly with the Play button.

Suggested direction:

- Keep the Play/Pause button as the center of the playback cluster.

- Add a circular arrow/restart control visually wrapped around or immediately adjacent to the Play button.

- The restart action should feel primary and tactile.

- It should restart playback from the beginning of the active phrase, active practice region, or active loop context.

The interaction should feel like:

`Replay this practice unit from the beginning`

not like:

`generic rewind`

---

## Naming

Avoid the label `To Start`.

If text is needed anywhere, prefer:

- Restart

- Restart Phrase

- Replay

The best primary visible UI should likely be icon-based with tooltip text.

Suggested tooltip:

`Restart active phrase`

or, when a practice region is active:

`Restart active region`

---

## Desired Transport Structure

The transport should feel grouped like this:

Playback Practice Cluster:

- Play/Pause

- Restart/Replay

Loop Mode:

- Loop phrase / play through / loop region if applicable

Phrase Actions:

- Edit phrase

- Delete phrase

- Add phrase or add region depending on context

Speed:

- 100% selector

---

## Keep The Plus Button

Keep the `+` button if it already feels good.

It can remain icon-first, especially if hover text explains the action clearly.

The plus button should remain contextual:

- If no phrase exists or app is in song-level editing, it may create a new phrase.

- If inside an active phrase/internal practice region workflow, it may create a practice region if that is the chosen behavior.

Do not over-label the plus button if the hover text is clear.

---

## Loop Control

Keep the ability to switch between looping the active phrase/region and playing through the song.

This is an important Woodshed practice function.

However, make sure it visually belongs to playback/practice flow, not editing tools.

---

## Avoid

Do not:

- Add Fit All back to the transport

- Keep `To Start` as a text button

- Add bulky labels

- Add DAW-like complexity

- Create visual noise around the play button

- Make the restart ring flashy or game-like

---

## Visual Tone

The redesigned playback cluster should feel:

- elegant

- tactile

- calm

- focused

- musician-native

- premium

It should not feel:

- gimmicky

- overly animated

- neon/game-like

- cluttered

---

## Final Intent

The transport bar should communicate:

“This app is built for repetition and focused practice.”

Not:

“This is a generic media player.”