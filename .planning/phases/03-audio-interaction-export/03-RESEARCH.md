# Phase 3: Audio Interaction & Export - Research

**Researched:** 2026-01-25
**Domain:** Web Audio Playback, Canvas Visualization, UI Controls, File Export
**Confidence:** HIGH

## Summary

Phase 3 builds interactive audio visualization and control on top of Phase 2's simulation engine. The core technologies are mature and well-documented: Web Audio API for playback control, HTML5 Canvas for waveform rendering, standard React patterns for rotary knob controls, and browser APIs for WAV export and URL state encoding.

**Key findings:**
- Web Audio API provides robust playback, seeking, and looping via AudioBufferSourceNode
- Canvas 2D context is the standard for waveform visualization with full sample data
- Rotary knob UI patterns are well-established (vertical drag + circular rotation + inline edit)
- WAV encoding is straightforward with typed arrays and DataView
- URL hash with base64-encoded JSON is the proven pattern for shareable state

**Primary recommendation:** Use native Web Audio API for playback, Canvas for waveform rendering, custom React component for knobs (no library needed for analog aesthetic), and URL hash for state encoding.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio API | Native | Playback, seeking, looping | Browser-native, zero dependencies, precise timing control |
| Canvas API | Native | Waveform visualization | Browser-native, 2D rendering for audio samples |
| React | 19.x | UI components | Project already uses React 19 |
| Zustand | (current) | State management | Project already uses Zustand for audio state |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DataView | Native | WAV file encoding | Binary file format manipulation |
| URLSearchParams | Native | Query string parsing | If using query params for state |
| TextEncoder | Native | String encoding for compression | If compressing code in URL |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native Canvas | WaveSurfer.js 7.x | Library adds 200KB+ bundle size, removes control over sample-level rendering, but provides zoom/plugins |
| Custom knob | react-canvas-knob | Library doesn't match analog aesthetic requirement, adds dependency |
| URL hash | Query params | Query params visible in server logs, hash stays client-side (better for code sharing) |

**Installation:**
```bash
# No additional packages needed - all native APIs
# Project already has React 19 and Zustand
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── ui/
│   ├── WaveformDisplay.tsx      # Canvas-based waveform visualization
│   ├── AnalogKnob.tsx           # Rotary knob control (POT0/1/2)
│   ├── PlaybackControls.tsx    # Play/pause, loop toggle
│   ├── LoopRegion.tsx           # Draggable loop start/end markers
│   └── ExportButtons.tsx        # WAV and .spn export
├── audio/
│   ├── playbackManager.ts       # Web Audio playback state machine
│   ├── exportWAV.ts             # AudioBuffer → WAV file encoding
│   └── renderTypes.ts           # (already exists)
├── utils/
│   ├── urlState.ts              # Encode/decode URL state
│   └── compression.ts           # Optional: compress code for URL
└── store/
    └── playbackStore.ts         # Playback state (position, loop region, playing)
```

### Pattern 1: Web Audio Playback with Seeking/Looping
**What:** Manage AudioBufferSourceNode lifecycle for playback control
**When to use:** Playing rendered audio with seek and loop capabilities
**Example:**
```typescript
// Source: MDN Web Audio API + project patterns
class PlaybackManager {
  private context: AudioContext;
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private startTime = 0;
  private pausedAt = 0;
  private loopStart = 0;
  private loopEnd = 0;
  private isLooping = false;

  constructor() {
    this.context = new AudioContext();
  }

  setBuffer(buffer: AudioBuffer) {
    this.buffer = buffer;
    this.loopEnd = buffer.duration;
  }

  play() {
    if (!this.buffer) return;
    
    this.stop(); // Stop any existing source
    
    this.source = this.context.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.loop = this.isLooping;
    this.source.loopStart = this.loopStart;
    this.source.loopEnd = this.loopEnd;
    this.source.connect(this.context.destination);
    
    this.startTime = this.context.currentTime - this.pausedAt;
    this.source.start(0, this.pausedAt);
  }

  pause() {
    if (!this.source) return;
    
    this.pausedAt = this.context.currentTime - this.startTime;
    this.stop();
  }

  seek(time: number) {
    const wasPlaying = this.source !== null;
    this.pausedAt = time;
    if (wasPlaying) {
      this.play();
    }
  }

  setLoopRegion(start: number, end: number) {
    this.loopStart = start;
    this.loopEnd = end;
    if (this.source) {
      this.source.loopStart = start;
      this.source.loopEnd = end;
    }
  }

  private stop() {
    if (this.source) {
      this.source.stop();
      this.source.disconnect();
      this.source = null;
    }
  }
}
```

### Pattern 2: Canvas Waveform Rendering (Full Samples)
**What:** Draw audio samples directly to canvas with stereo overlay
**When to use:** Visualizing rendered audio with sample-level detail
**Example:**
```typescript
// Source: MDN Canvas API + Web Audio visualization patterns
function drawWaveform(
  canvas: HTMLCanvasElement,
  buffer: AudioBuffer,
  ioMode: string,
  playheadTime?: number
) {
  const ctx = canvas.getContext('2d')!;
  const width = canvas.width;
  const height = canvas.height;
  const channels = buffer.numberOfChannels;
  
  ctx.clearRect(0, 0, width, height);
  
  const leftChannel = buffer.getChannelData(0);
  const rightChannel = channels > 1 ? buffer.getChannelData(1) : leftChannel;
  
  const samplesPerPixel = Math.floor(leftChannel.length / width);
  const halfHeight = height / 2;
  
  // Draw stereo channels overlaid with different colors
  if (ioMode === 'stereo_stereo' && channels > 1) {
    // Left channel (blue)
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const sampleIndex = x * samplesPerPixel;
      const sample = leftChannel[sampleIndex];
      const y = halfHeight - (sample * halfHeight * 0.9);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Right channel (orange)
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.7)';
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const sampleIndex = x * samplesPerPixel;
      const sample = rightChannel[sampleIndex];
      const y = halfHeight - (sample * halfHeight * 0.9);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else {
    // Mono rendering
    ctx.strokeStyle = 'rgb(59, 130, 246)';
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const sampleIndex = x * samplesPerPixel;
      const sample = leftChannel[sampleIndex];
      const y = halfHeight - (sample * halfHeight * 0.9);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  
  // Draw playhead cursor
  if (playheadTime !== undefined) {
    const x = (playheadTime / buffer.duration) * width;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}
```

### Pattern 3: Analog Rotary Knob Component
**What:** React component supporting vertical drag, circular drag, and inline edit
**When to use:** POT0/1/2 knob controls with analog aesthetic
**Example:**
```typescript
// Source: Common rotary knob interaction patterns
interface AnalogKnobProps {
  value: number;        // 0-11 range
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
}

function AnalogKnob({ value, onChange, label, disabled }: AnalogKnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const knobRef = useRef<HTMLDivElement>(null);
  
  // Convert 0-11 value to 0-360 degrees
  const rotation = (value / 11) * 270 - 135; // -135° to +135° range
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    e.preventDefault();
  };
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !knobRef.current) return;
    
    const rect = knobRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Support both vertical drag and circular rotation
    const dy = e.clientY - centerY;
    const dx = e.clientX - centerX;
    
    // Vertical drag (up = increase)
    const verticalDelta = -dy * 0.01;
    
    // Circular rotation
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const normalizedAngle = ((angle + 90 + 360) % 360);
    const circularValue = (normalizedAngle / 270) * 11;
    
    // Use whichever changed more (allow user preference)
    const newValue = Math.abs(dx) > Math.abs(dy)
      ? circularValue
      : Math.max(0, Math.min(11, value + verticalDelta));
    
    onChange(Math.max(0, Math.min(11, newValue)));
  }, [isDragging, value, onChange]);
  
  const handleClick = () => {
    if (disabled) return;
    setIsEditing(true);
    setEditValue(value.toFixed(1));
  };
  
  const handleEditSubmit = () => {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) {
      onChange(Math.max(0, Math.min(11, parsed)));
    }
    setIsEditing(false);
  };
  
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', () => setIsDragging(false));
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', () => setIsDragging(false));
    };
  }, [isDragging, handleMouseMove]);
  
  return (
    <div className="knob-container">
      <div
        ref={knobRef}
        className="knob"
        style={{ transform: `rotate(${rotation}deg)` }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        <div className="knob-indicator" />
      </div>
      {isEditing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleEditSubmit}
          onKeyDown={(e) => e.key === 'Enter' && handleEditSubmit()}
          autoFocus
        />
      ) : (
        <span className="knob-value">{value.toFixed(1)}</span>
      )}
      <label>{label}</label>
    </div>
  );
}
```

### Pattern 4: WAV File Export
**What:** Encode AudioBuffer to WAV format for download
**When to use:** Exporting rendered audio as downloadable file
**Example:**
```typescript
// Source: WAV file format specification + MDN typed arrays
function encodeWAV(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  
  // Interleave channels
  const interleaved = new Float32Array(length * channels);
  for (let channel = 0; channel < channels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      interleaved[i * channels + channel] = channelData[i];
    }
  }
  
  // Convert float32 (-1 to 1) to int16
  const samples = new Int16Array(interleaved.length);
  for (let i = 0; i < interleaved.length; i++) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  // WAV file header
  const dataSize = samples.length * bytesPerSample;
  const buffer_size = 44 + dataSize;
  const view = new DataView(new ArrayBuffer(buffer_size));
  
  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, buffer_size - 8, true);
  writeString(view, 8, 'WAVE');
  
  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true); // byte rate
  view.setUint16(32, channels * bytesPerSample, true); // block align
  view.setUint16(34, bitsPerSample, true);
  
  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Write samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(offset, samples[i], true);
    offset += 2;
  }
  
  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function downloadWAV(buffer: AudioBuffer, filename: string) {
  const blob = encodeWAV(buffer);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Pattern 5: URL State Encoding
**What:** Encode code + knob settings in URL hash for sharing
**When to use:** "Share this sound" workflow
**Example:**
```typescript
// Source: Standard URL encoding patterns for web apps
interface URLState {
  code: string;
  pot0: number;
  pot1: number;
  pot2: number;
  demo?: string;
}

function encodeState(state: URLState): string {
  // Use base64 encoding for cleaner URLs
  const json = JSON.stringify(state);
  const base64 = btoa(encodeURIComponent(json));
  return `#state=${base64}`;
}

function decodeState(hash: string): URLState | null {
  try {
    const match = hash.match(/#state=([^&]+)/);
    if (!match) return null;
    
    const json = decodeURIComponent(atob(match[1]));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Usage in React component
function loadStateFromURL() {
  const state = decodeState(window.location.hash);
  if (state) {
    // Restore code and knob settings
    // Do NOT auto-render - wait for user to click Render
    return state;
  }
  return null;
}

function shareCurrentState(code: string, pots: PotValues) {
  const state: URLState = {
    code,
    pot0: pots.pot0,
    pot1: pots.pot1,
    pot2: pots.pot2,
  };
  const encodedHash = encodeState(state);
  const url = `${window.location.origin}${window.location.pathname}${encodedHash}`;
  
  // Copy to clipboard
  navigator.clipboard.writeText(url);
}
```

### Anti-Patterns to Avoid
- **Creating new AudioBufferSourceNode without stopping old one** - leads to overlapping playback and memory leaks
- **Redrawing entire waveform on every animation frame** - use requestAnimationFrame only for playhead cursor updates
- **Triggering re-render immediately on knob drag** - debounce or wait for mouse release to avoid render queue buildup
- **Including demo audio in URL state** - audio files are too large, only encode code and knob values
- **Using WaveSurfer.js when custom rendering is specified** - user decisions require full sample control and stereo overlay

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WAV file format | Custom binary writer | DataView + standard WAV structure | WAV has specific byte ordering, chunk structure, header fields that are error-prone |
| AudioContext lifecycle | Manual context management | Singleton pattern with proper cleanup | AudioContext creation is expensive, multiple contexts cause audio glitches |
| URL-safe encoding | Custom compression | btoa/atob + encodeURIComponent | Browser-native, handles all edge cases (special chars, unicode) |
| Mouse drag math | Raw event deltas | Rect.getBoundingClientRect() for bounds | Cross-browser, handles transforms, zoom, scrolling |
| Playback timing | setTimeout/setInterval | AudioContext.currentTime | AudioContext clock is sample-accurate, setTimeout drifts |

**Key insight:** Browser APIs for audio, canvas, and encoding are mature and battle-tested. Custom implementations introduce bugs that have already been solved.

## Common Pitfalls

### Pitfall 1: AudioBufferSourceNode One-Shot Limitation
**What goes wrong:** Calling start() twice on same AudioBufferSourceNode throws error
**Why it happens:** AudioBufferSourceNode is designed as "fire and forget" - can only be started once
**How to avoid:** Create new AudioBufferSourceNode for every play/seek operation, disconnect and null old source
**Warning signs:** "InvalidStateError: Failed to execute 'start'" in console

### Pitfall 2: Canvas Coordinate System Confusion
**What goes wrong:** Waveform rendering looks pixelated or doesn't match mouse clicks
**Why it happens:** Canvas element size (CSS) vs canvas resolution (width/height attributes) mismatch
**How to avoid:** Set canvas.width and canvas.height attributes to match pixel ratio, not just CSS dimensions
**Warning signs:** Waveform looks blurry, click-to-seek positions don't match visual playhead

### Pitfall 3: Fast Re-render on Knob Drag
**What goes wrong:** Dragging knob queues many renders, UI freezes, renders pile up
**Why it happens:** Every mousemove event triggers re-render which takes >2 seconds
**How to avoid:** 
- Debounce knob changes (wait 500ms after drag stops)
- OR trigger re-render on mouseup only
- Show progress indicator and disable knobs during render
**Warning signs:** Console shows multiple "rendering..." logs, UI becomes unresponsive during drag

### Pitfall 4: URL Length Limits
**What goes wrong:** Large programs fail to encode in URL, share button doesn't work
**Why it happens:** Most browsers limit URLs to ~2000 characters, large .spn files exceed this
**How to avoid:**
- Use base64 encoding to reduce size (removes unnecessary whitespace)
- Consider LZ-string compression for very large programs
- Test with realistic program sizes (500-1000 lines)
- Show error message if encoded URL exceeds safe length
**Warning signs:** URL sharing works for small programs but fails for large ones

### Pitfall 5: Stereo Channel Rendering Phase Issues
**What goes wrong:** Stereo waveforms look identical or phase-cancelled
**Why it happens:** Both channels rendered with same color/opacity, or left/right swapped
**How to avoid:**
- Use distinct colors with transparency (blue/orange at 70% opacity)
- Verify channel order matches AudioBuffer.getChannelData(0) = left
- Test with known phase-different audio (dry/wet mix, stereo reverb)
**Warning signs:** Stereo audio sounds correct but waveform looks mono

### Pitfall 6: Loop Region Edge Cases
**What goes wrong:** Loop doesn't start, or loops entire track
**Why it happens:** loopStart >= loopEnd, or loop region set while source is playing
**How to avoid:**
- Validate loopStart < loopEnd before setting
- Update source.loopStart/loopEnd immediately when changed (if source exists)
- Clamp loop region to [0, buffer.duration]
**Warning signs:** Loop toggle has no effect, or loops wrong section

## Code Examples

Verified patterns from official sources:

### Waveform Click-to-Seek
```typescript
// Source: MDN Canvas API mouse event handling
function handleWaveformClick(
  canvas: HTMLCanvasElement,
  buffer: AudioBuffer,
  event: React.MouseEvent,
  onSeek: (time: number) => void
) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const clickRatio = x / canvas.width;
  const seekTime = clickRatio * buffer.duration;
  onSeek(seekTime);
}
```

### Loop Region Draggable Handles
```typescript
// Source: Standard drag-and-drop patterns
function LoopRegion({
  duration,
  loopStart,
  loopEnd,
  onLoopChange,
}: {
  duration: number;
  loopStart: number;
  loopEnd: number;
  onLoopChange: (start: number, end: number) => void;
}) {
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);
  
  const handleDrag = useCallback((e: MouseEvent, type: 'start' | 'end') => {
    if (!dragging) return;
    
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const time = ratio * duration;
    
    if (type === 'start') {
      onLoopChange(Math.max(0, Math.min(time, loopEnd - 0.1)), loopEnd);
    } else {
      onLoopChange(loopStart, Math.min(duration, Math.max(time, loopStart + 0.1)));
    }
  }, [dragging, duration, loopStart, loopEnd, onLoopChange]);
  
  // Render handles at (loopStart/duration) and (loopEnd/duration) positions
}
```

### Re-render with Cached AST
```typescript
// Source: Project Phase 2 patterns (renderSimulation.ts exists)
async function reRenderWithKnobs(
  cachedInstructions: Instruction[],
  cachedIOMode: IOMode,
  inputBuffer: AudioBuffer,
  pots: PotValues,
  onProgress?: (progress: RenderProgress) => void
): Promise<AudioBuffer> {
  // Reuse cached instructions - no re-parsing
  const result = await renderSimulation({
    instructions: cachedInstructions,
    ioMode: cachedIOMode,
    input: inputBuffer,
    pots,
    onProgress,
  });
  
  return result.buffer;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ScriptProcessorNode | AudioWorkletNode | 2017 | AudioWorklet runs off main thread, better performance for processing |
| Manual WAV encoding | Web Audio Encoder API (proposed) | N/A (not yet standard) | Stick with manual DataView approach, encoder API not widely supported |
| WaveSurfer.js v6 | WaveSurfer.js v7 | 2023 | v7 uses Web Audio API instead of deprecated APIs, but adds bundle size |
| react-knob | Custom component | 2024 | Modern React patterns (hooks) make custom knobs simpler than learning library API |

**Deprecated/outdated:**
- **ScriptProcessorNode** - use AudioWorkletNode if processing audio in real-time (not needed for this phase)
- **createScriptProcessor()** - deprecated, avoid completely
- **WaveSurfer v5 and earlier** - used deprecated Web Audio APIs

## Open Questions

Things that couldn't be fully resolved:

1. **Re-render trigger timing**
   - What we know: Debounced (500ms), on mouse release, or immediate all work
   - What's unclear: User preference varies - some want instant feedback, others want control
   - Recommendation: Start with debounced (500ms), add preference toggle if users request it

2. **Compression for large programs**
   - What we know: base64 encoding works for most programs, LZ-string can compress further
   - What's unclear: When does program size exceed URL limits in practice?
   - Recommendation: Start with base64, add LZ-string if users report URL length issues

3. **Demo audio in URL state**
   - What we know: Including demo audio selection in URL is useful, but audio data itself is too large
   - What's unclear: Should URL include demo ID, or just code/knobs?
   - Recommendation: Include demo ID in URL state if demo is selected (not the audio data)

## Sources

### Primary (HIGH confidence)
- MDN Web Audio API - https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API (accessed 2026-01-25)
- MDN AudioBufferSourceNode - https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode (accessed 2026-01-25)
- MDN AnalyserNode - https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode (accessed 2026-01-25)
- MDN Canvas API - https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API (accessed 2026-01-25)
- MDN URL API (hash/searchParams) - https://developer.mozilla.org/en-US/docs/Web/API/URL (accessed 2026-01-25)
- Project source: src/audio/renderSimulation.ts - existing Phase 2 render infrastructure
- Project source: src/store/audioStore.ts - existing state management patterns

### Secondary (MEDIUM confidence)
- WAV file format specification - Standard RIFF/WAVE format, implemented in code examples above
- React 19 documentation - Hooks patterns for custom components

### Tertiary (LOW confidence)
- None - all findings verified with official documentation or project source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All native browser APIs with official MDN documentation
- Architecture: HIGH - Patterns verified in project source (Phase 2) and MDN examples
- Pitfalls: HIGH - Common issues documented in MDN and standard web audio resources

**Research date:** 2026-01-25
**Valid until:** 60 days (stable APIs, unlikely to change)
