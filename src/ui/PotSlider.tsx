import { useState, useEffect } from 'react'

interface PotSliderProps {
  value: number
  onChange: (value: number) => void
  label: string
  disabled?: boolean
  min?: number
  max?: number
  step?: number
  displayFormat?: (v: number) => string
}

export default function PotSlider({
  value,
  onChange,
  label,
  disabled = false,
  min = 0,
  max = 1,
  step = 0.01,
  displayFormat,
}: PotSliderProps) {
  const [inputValue, setInputValue] = useState(value.toFixed(2))

  useEffect(() => {
    setInputValue(displayFormat ? displayFormat(value) : value.toFixed(2))
  }, [value, displayFormat])

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    onChange(v)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleInputBlur = () => {
    const parsed = parseFloat(inputValue)
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed))
      onChange(clamped)
    } else {
      setInputValue(displayFormat ? displayFormat(value) : value.toFixed(2))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleInputBlur()
  }

  return (
    <div className="pot-slider-row">
      <label className="pot-slider-label">{label}</label>
      <input
        type="range"
        className="pot-slider-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleSliderChange}
        disabled={disabled}
      />
      <input
        type="text"
        className="pot-slider-input"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
    </div>
  )
}
