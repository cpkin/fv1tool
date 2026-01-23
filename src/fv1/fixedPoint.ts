/**
 * FV-1 Fixed-Point Math Helpers
 * 
 * Implements 24-bit two's-complement fractional arithmetic (S1.23 format)
 * with saturation to match FV-1 hardware behavior.
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/arch.html
 */

import { FRAC_BITS, FP_MAX, FP_MIN, COEFF_RANGES, LOG_EXP_SHIFT } from './constants';

/**
 * Converts a floating-point value to 1.23 fixed-point format
 * 
 * @param value - Floating-point value in range [-1.0, +1.0)
 * @returns Fixed-point value as a 24-bit signed integer
 */
export function floatToFixed(value: number): number {
  // Clamp to valid range
  const clamped = Math.max(FP_MIN, Math.min(FP_MAX, value));
  
  // Convert to fixed-point: multiply by 2^23 and round
  const fixed = Math.round(clamped * (1 << FRAC_BITS));
  
  // Ensure 24-bit two's complement range
  return clamp24Bit(fixed);
}

/**
 * Converts a 1.23 fixed-point value to floating-point
 * 
 * @param fixed - Fixed-point value as a 24-bit signed integer
 * @returns Floating-point value in range [-1.0, +1.0)
 */
export function fixedToFloat(fixed: number): number {
  // Ensure value is treated as 24-bit two's complement
  const value = signExtend24Bit(fixed);
  
  // Convert to float: divide by 2^23
  return value / (1 << FRAC_BITS);
}

/**
 * Clamps a value to 24-bit two's-complement range
 * Range: [-8388608, +8388607] (0x800000 to 0x7FFFFF)
 * 
 * @param value - Input value
 * @returns Clamped value in 24-bit range
 */
function clamp24Bit(value: number): number {
  const MAX_24BIT = 0x7FFFFF;  // +8388607
  const MIN_24BIT = -0x800000; // -8388608
  
  if (value > MAX_24BIT) return MAX_24BIT;
  if (value < MIN_24BIT) return MIN_24BIT;
  return Math.trunc(value);
}

/**
 * Sign-extends a 24-bit value to handle two's complement
 * 
 * @param value - 24-bit value (may be stored in larger integer)
 * @returns Sign-extended value
 */
function signExtend24Bit(value: number): number {
  // Mask to 24 bits
  const masked = value & 0xFFFFFF;
  
  // If sign bit (bit 23) is set, extend sign
  if (masked & 0x800000) {
    return masked | 0xFF000000;
  }
  
  return masked;
}

/**
 * Saturating addition in 1.23 fixed-point format
 * 
 * @param a - First operand (floating-point)
 * @param b - Second operand (floating-point)
 * @returns Result with saturation (floating-point)
 */
export function saturatingAdd(a: number, b: number): number {
  const sum = a + b;
  
  // Clamp to valid range
  if (sum > FP_MAX) return FP_MAX;
  if (sum < FP_MIN) return FP_MIN;
  
  return sum;
}

/**
 * Saturating subtraction in 1.23 fixed-point format
 * 
 * @param a - First operand (floating-point)
 * @param b - Second operand (floating-point)
 * @returns Result with saturation (floating-point)
 */
export function saturatingSub(a: number, b: number): number {
  const diff = a - b;
  
  // Clamp to valid range
  if (diff > FP_MAX) return FP_MAX;
  if (diff < FP_MIN) return FP_MIN;
  
  return diff;
}

/**
 * Saturating multiplication in 1.23 fixed-point format
 * 
 * @param a - First operand (floating-point)
 * @param b - Second operand (floating-point)
 * @returns Result with saturation (floating-point)
 */
export function saturatingMul(a: number, b: number): number {
  const product = a * b;
  
  // Clamp to valid range
  if (product > FP_MAX) return FP_MAX;
  if (product < FP_MIN) return FP_MIN;
  
  return product;
}

/**
 * Clamps a coefficient to the RDA instruction range [-2.0, +1.998]
 * 
 * @param coeff - Coefficient value
 * @returns Clamped coefficient
 */
export function clampRDACoeff(coeff: number): number {
  return Math.max(COEFF_RANGES.RDA.min, Math.min(COEFF_RANGES.RDA.max, coeff));
}

/**
 * Clamps a coefficient to the RDAX/SOF instruction range [-2.0, +1.9999389]
 * 
 * @param coeff - Coefficient value
 * @returns Clamped coefficient
 */
export function clampRDAXCoeff(coeff: number): number {
  return Math.max(COEFF_RANGES.RDAX.min, Math.min(COEFF_RANGES.RDAX.max, coeff));
}

/**
 * Applies LOG instruction scaling (right-shift by 4 bits)
 * 
 * LOG output is right-shifted by 4 bits per FV-1 specification
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html
 * 
 * @param value - Input value (floating-point)
 * @returns Scaled value
 */
export function applyLogShift(value: number): number {
  // Right-shift by 4 bits is equivalent to dividing by 16
  return value / (1 << LOG_EXP_SHIFT);
}

/**
 * Applies EXP instruction scaling (expects input right-shifted by 4 bits)
 * 
 * EXP expects input to be right-shifted by 4 bits
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html
 * 
 * @param value - Input value (floating-point, already shifted)
 * @returns Scaled value
 */
export function applyExpShift(value: number): number {
  // Left-shift by 4 bits to undo the expected shift
  return saturatingMul(value, 1 << LOG_EXP_SHIFT);
}

/**
 * Saturates a value to the FV-1 accumulator range
 * 
 * @param value - Input value
 * @returns Saturated value in [-1.0, +0.999999881]
 */
export function saturate(value: number): number {
  if (value > FP_MAX) return FP_MAX;
  if (value < FP_MIN) return FP_MIN;
  return value;
}
