/**
 * FV-1 Fixed-Point Constants
 * 
 * The FV-1 uses 24-bit two's-complement fractional format (S1.23):
 * - 1 sign bit
 * - 23 fractional bits
 * - Range: [-1.0, +0.999999881]
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/arch.html
 */

/**
 * Number of fractional bits in the 1.23 fixed-point format
 */
export const FRAC_BITS = 23;

/**
 * Maximum representable value in 1.23 format: +0.999999881
 * (0x7FFFFF / 2^23)
 */
export const FP_MAX = 0.999999881;

/**
 * Minimum representable value in 1.23 format: -1.0
 * (0x800000 / 2^23, interpreted as two's complement)
 */
export const FP_MIN = -1.0;

/**
 * Coefficient ranges for various instructions
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html
 */
export const COEFF_RANGES = {
  /**
   * RDA coefficient: 11-bit signed, range [-2.0, +1.998]
   * S1.9 format (1 sign bit, 9 fractional bits)
   */
  RDA: {
    min: -2.0,
    max: 1.998046875, // 0x3FF / 2^9
    bits: 11,
    fracBits: 9,
  },
  
  /**
   * RDAX coefficient: 16-bit signed, range [-2.0, +1.9999389]
   * S1.14 format (1 sign bit, 14 fractional bits)
   */
  RDAX: {
    min: -2.0,
    max: 1.99993896484375, // 0x7FFF / 2^14
    bits: 16,
    fracBits: 14,
  },
  
  /**
   * SOF coefficient: 16-bit signed, range [-2.0, +1.9999389]
   * Same as RDAX
   */
  SOF: {
    min: -2.0,
    max: 1.99993896484375,
    bits: 16,
    fracBits: 14,
  },
} as const;

/**
 * LOG instruction right-shifts output by 4 bits
 * EXP instruction expects input right-shifted by 4 bits
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html
 */
export const LOG_EXP_SHIFT = 4;

/**
 * FV-1 sample rate in Hz
 * Reference: http://www.spinsemi.com/knowledge_base/arch.html
 */
export const FV1_SAMPLE_RATE = 32000; // Using 32kHz per product requirements

/**
 * Maximum delay RAM size in samples
 * Reference: FV-1 datasheet
 */
export const MAX_DELAY_RAM = 32768;

/**
 * Number of general-purpose registers (REG0-REG31)
 */
export const NUM_REGISTERS = 32;

/**
 * Instructions executed per audio sample
 */
export const INSTRUCTIONS_PER_SAMPLE = 128;

/**
 * POT update block size (samples)
 * POT values are updated every 32 samples
 */
export const POT_UPDATE_BLOCK_SIZE = 32;
