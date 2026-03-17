/**
 * FV-1 Interpreter Types
 * 
 * Type definitions for FV-1 DSP state and compiled instructions.
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/arch.html
 */

/**
 * FV-1 IO mode configuration
 * 
 * Determines how input/output channels are routed:
 * - mono_mono: Single input, single output
 * - mono_stereo: Single input, stereo output (L/R)
 * - stereo_stereo: Stereo input, stereo output
 */
export type IOMode = 'mono_mono' | 'mono_stereo' | 'stereo_stereo';

/**
 * POT (potentiometer) values
 * 
 * Three POT inputs available to FV-1 programs, each in range [0.0, 1.0]
 */
export interface PotValues {
  pot0: number;
  pot1: number;
  pot2: number;
}

/**
 * FV-1 interpreter state
 * 
 * Maintains all architectural state for the FV-1 DSP:
 * - ACC: Accumulator (primary working register)
 * - PACC: Previous accumulator (ACC value from previous sample)
 * - LR: Left/Right flag for stereo processing
 * - Registers: 32 general-purpose registers (REG0-REG31)
 * - Delay RAM: 32768-sample delay memory (floating-point)
 * - POT values: Current potentiometer settings
 * - DAC outputs: Current left/right output values
 */
export interface FV1State {
  /**
   * Accumulator - primary working register
   * Range: [-1.0, +0.999999881] (S1.23 format)
   */
  acc: number;
  
  /**
   * Previous accumulator - holds ACC value from previous sample
   * Many instructions use PACC as an operand
   */
  pacc: number;
  
  /**
   * Left/Right flag
   * 0 = left channel processing
   * 1 = right channel processing
   */
  lr: number;

  /**
   * ADC input registers
   * Updated per sample based on IO mode
   */
  adcL: number;
  adcR: number;
  
  /**
   * General-purpose registers (REG0-REG31)
   * Each register holds a value in S1.23 format
   */
  registers: Float32Array;
  
  /**
   * Delay RAM memory
   * 32768 samples of floating-point delay storage
   * 
   * Note: FV-1 delay RAM is floating-point with limited resolution.
   * For precision filters, use registers instead of delay memory.
   * Reference: http://spinsemi.com/knowledge_base/pgm_quick.html
   */
  delayRam: Int32Array;
  
  /**
   * Current delay RAM write pointer
   * Used by WRAP instruction to manage circular buffer
   */
  delayWritePtr: number;

  /**
   * Last delay RAM read value (LR register)
   */
  delayLR: number;
  
  /**
   * POT (potentiometer) values
   * Updated every 32 samples
   */
  pots: PotValues;
  
  /**
   * DAC output for left channel
   */
  dacL: number;
  
  /**
   * DAC output for right channel
   */
  dacR: number;

  /**
   * Flags indicating DACL/DACR were written this sample
   */
  dacLWritten: boolean;
  dacRWritten: boolean;
  
  /**
   * IO mode configuration
   */
  ioMode: IOMode;

  /**
   * CHO delay depth multiplier (debug/quality tuning)
   */
  choDepth: number;
  
  /**
   * Current sample counter (for POT update timing)
   */
  sampleCounter: number;
  
  /**
   * LFO (Low-Frequency Oscillator) state
   * Used by CHO instruction family
   */
  lfo: {
    /**
     * Current normalized sine/ramp output values
     */
    sin0: number;
    sin1: number;
    rmp0: number;
    rmp1: number;

    /**
     * Integer LFO output values
     */
    sin0Out: number;
    sin1Out: number;
    rmp0Val: number;
    rmp1Val: number;
    rmp0Rptr2: number;
    rmp1Rptr2: number;
    rmp0Max: number;
    rmp1Max: number;

    /**
     * Internal LFO accumulator values
     */
    sin0Int: number;
    sin1Int: number;
    sin0Cos: number;
    sin1Cos: number;
    rmp0Pos: number;
    rmp1Pos: number;
    rmp0Xfade: number;
    rmp1Xfade: number;
    rmp0XfadeVal: number;
    rmp1XfadeVal: number;

    /**
     * Phase accumulators (0.0-1.0)
     */
    sin0Phase: number;
    sin1Phase: number;
    rmp0Phase: number;
    rmp1Phase: number;

    /**
     * Per-sample phase increments
     */
    sin0Rate: number;
    sin1Rate: number;
    rmp0Rate: number;
    rmp1Rate: number;

    /**
     * LFO amplitude settings from WLDS/WLDR
     */
    sin0Amp: number;
    sin1Amp: number;
    rmp0Amp: number;
    rmp1Amp: number;
  };

  /**
   * Next program counter for SKP/JMP instructions
   * If set to non-null, interpreter will jump to this PC
   * SKP/JMP handlers set this field to signal control flow change
   */
  nextPc: number | null;
}

/**
 * Compiled FV-1 instruction
 * 
 * Represents a single instruction ready for execution by the interpreter.
 * This is the output of the compiler/assembler phase.
 */
export interface CompiledInstruction {
  /**
   * Opcode identifier (e.g., 'rdax', 'sof', 'wra')
   */
  opcode: string;
  
  /**
   * Operand values (parsed and resolved)
   * Format varies by instruction
   */
  operands: number[];
  
  /**
   * Source line number (for debugging)
   */
  line: number;
}

/**
 * Decoded RAW instruction payload
 *
 * Used by RAW handler to execute decoded opcode + operands.
 */
export interface RawDecodedInstruction {
  opcode: string;
  operands: number[];
}

/**
 * FV-1 compiled program
 * 
 * A complete program ready for execution, consisting of up to 128 instructions
 */
export interface CompiledProgram {
  /**
   * Array of compiled instructions (up to 128)
   */
  instructions: CompiledInstruction[];
  
  /**
   * IO mode for this program
   */
  ioMode: IOMode;
  
  /**
   * Program metadata (optional)
   */
  metadata?: {
    name?: string;
    description?: string;
  };
}

/**
 * Instruction handler function type
 * 
 * Each opcode has a handler that executes the instruction's behavior
 */
export type InstructionHandler = (
  state: FV1State,
  operands: number[]
) => void;
