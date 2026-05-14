# Woodshed Desktop App Flow

## Primary Desktop Workflow

1. User opens or creates a project.
2. User imports or selects a song.
3. User uses the waveform to find a section.
4. User creates a phrase.
5. User adjusts phrase start/end boundaries.
6. User names the phrase.
7. User optionally adds notes.
8. User optionally creates lightweight segments inside the phrase.
9. User saves/syncs the project.
10. User later opens the mobile app to practice.

## Desktop Layout Flow

The desktop app should use a single-window focused workspace:

1. Minimal top header
2. Mini-map waveform/navigation strip
3. Main waveform editor
4. Transport/playback bar
5. Hideable bottom inspector panel

## Header

The header should stay minimal.

It may include:

- Project name
- Save/sync status
- Basic account/settings access

Avoid making the header visually dominant.

## Mini-map

The mini-map sits above the main waveform.

Purpose:

- Song-level navigation
- High-level phrase visibility
- Quick jumping through the track

## Main Waveform

The main waveform is the heart of the desktop app.

It should dominate the visual hierarchy.

Purpose:

- Phrase creation
- Loop boundary editing
- Playback position
- Segment visibility when a phrase is selected

## Transport Bar

The transport bar should feel desktop-native.

It may include:

- Play/pause
- Loop toggle
- Current time
- Speed
- Repeat mode
- Phrase/full song toggle

## Bottom Inspector Panel

The bottom inspector is persistent but hideable.

It changes based on context.

### No phrase selected

Show:

- Project summary
- Shortcuts
- Recent phrases or empty state

### Phrase selected

Show:

- Phrase name
- Start/end
- Notes
- Loop settings
- Segment list
- Add segment action

### Segment selected

Show:

- Segment name
- Segment start/end
- Notes
- Delete segment
