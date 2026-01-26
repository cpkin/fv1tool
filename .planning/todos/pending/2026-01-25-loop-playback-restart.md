---
created: 2026-01-25T19:27
title: Loop playback should restart at loop beginning instead of continuing
area: ui
files:
  - src/audio/playbackManager.ts
  - src/ui/PlaybackControls.tsx
---

## Problem

When loop playback is enabled and the playhead reaches the loop end point, playback continues through the rest of the waveform instead of jumping back to the loop start. This breaks the expected loop behavior where audio should continuously repeat between loop start and loop end markers.

Expected behavior: Playhead reaches loopEnd → immediately jumps to loopStart → continues playing (seamless loop).

Actual behavior: Playhead reaches loopEnd → continues past loop region → plays rest of waveform → stops at end.

This suggests the Web Audio API loop properties (loop, loopStart, loopEnd) on AudioBufferSourceNode are not being applied correctly, or the loop is being disabled after first playthrough.

## Solution

Investigate playbackManager.ts and PlaybackControls.tsx:
1. Verify that when isLooping is true, the AudioBufferSourceNode has loop=true set
2. Confirm loopStart and loopEnd are being set in seconds (not samples or other units)
3. Check if play() method correctly applies loop properties before calling start()
4. Verify loop state persists across playhead position updates (requestAnimationFrame updates shouldn't disable loop)

Likely issue: Loop properties not being set on the AudioBufferSourceNode, or being set in wrong units/format.
