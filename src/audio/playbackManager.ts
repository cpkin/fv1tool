/**
 * PlaybackManager - Singleton Web Audio playback state machine
 * 
 * Manages AudioBufferSourceNode lifecycle for play/pause/seek operations.
 * Each play() call creates a new AudioBufferSourceNode (required by Web Audio API).
 */
class PlaybackManager {
  private context: AudioContext | null = null
  private source: AudioBufferSourceNode | null = null
  private buffer: AudioBuffer | null = null
  private startTime = 0
  private pausedAt = 0

  /**
   * Initialize or resume AudioContext
   */
  private ensureContext() {
    if (!this.context) {
      this.context = new AudioContext()
    }
    // Resume context if suspended (browser autoplay policy)
    if (this.context.state === 'suspended') {
      this.context.resume()
    }
    return this.context
  }

  /**
   * Set the audio buffer to play
   */
  setBuffer(buffer: AudioBuffer) {
    this.buffer = buffer
    this.pausedAt = 0
  }

  /**
   * Start or resume playback
   */
  play() {
    if (!this.buffer) return

    this.stop() // Stop any existing source

    const context = this.ensureContext()
    
    this.source = context.createBufferSource()
    this.source.buffer = this.buffer
    this.source.connect(context.destination)
    
    this.startTime = context.currentTime - this.pausedAt
    this.source.start(0, this.pausedAt)
  }

  /**
   * Pause playback at current position
   */
  pause() {
    if (!this.source || !this.context) return
    
    this.pausedAt = this.context.currentTime - this.startTime
    this.stop()
  }

  /**
   * Stop playback and disconnect source
   */
  stop() {
    if (this.source) {
      try {
        this.source.stop()
      } catch {
        // Source may already be stopped
      }
      this.source.disconnect()
      this.source = null
    }
  }

  /**
   * Seek to a specific time in the buffer
   */
  seek(time: number) {
    if (!this.buffer) return

    const wasPlaying = this.source !== null
    const clampedTime = Math.max(0, Math.min(time, this.buffer.duration))
    this.pausedAt = clampedTime
    
    if (wasPlaying) {
      this.play()
    }
  }

  /**
   * Get current playback time
   */
  getCurrentTime(): number {
    if (!this.buffer) return 0
    
    if (this.source && this.context) {
      // Playing - calculate from context time
      return Math.min(
        this.context.currentTime - this.startTime,
        this.buffer.duration
      )
    }
    
    // Paused or stopped
    return this.pausedAt
  }

  /**
   * Check if currently playing
   */
  isPlaying(): boolean {
    return this.source !== null
  }

  /**
   * Get buffer duration
   */
  getDuration(): number {
    return this.buffer?.duration ?? 0
  }
}

// Export singleton instance
export const playbackManager = new PlaybackManager()
