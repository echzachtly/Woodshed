# Phrase Segments Spec

## Concept

Phrase segments are lightweight labeled regions inside a parent phrase.

They are useful for breaking a larger phrase into smaller musical chunks.

Example:

Parent phrase:
- 12 Bar Solo

Segments:
- First 4 Bars
- Turnaround
- Bend Run
- Ending Lick

## Important Naming

Prefer the term "Segment" in the code and UI.

Avoid deeply nested "sub-phrase" language.

## Data Model

A project contains phrases.

A phrase may contain segments.

Segments belong to one parent phrase.

There should only be one level of nesting.

Do not support:

- Segments inside segments
- Deep trees
- Complex folder structures

## Suggested Segment Fields

Each segment should include:

- id
- phraseId
- name
- startTime
- endTime
- notes
- createdAt
- updatedAt

## UX Rules

Segments should be visually secondary to phrases.

Segments should only become prominent when their parent phrase is selected.

Avoid cluttering the full-song waveform with too many segment labels.

## Required Behavior For This Pass

Implement basic:

- Create segment
- Edit segment name
- Edit segment start/end if existing app patterns support it
- Delete segment
- Select segment
- Show segment details in bottom inspector

## Non-Goals For This Pass

Do not implement:

- Segment practice stats
- Segment mastery tracking
- Segment difficulty ratings
- AI-generated segments
- Segment sharing
- Nested segment trees
- Advanced color systems
