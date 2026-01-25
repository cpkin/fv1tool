import { useState, useRef, useCallback, useEffect } from 'react'

interface AnalogKnobProps {
  value: number        // 0-11 range
  onChange: (value: number) => void
  label: string
  disabled?: boolean
}

export default function AnalogKnob({ value, onChange, label, disabled = false }: AnalogKnobProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [dragStartY, setDragStartY] = useState(0)
  const [dragStartValue, setDragStartValue] = useState(0)
  const knobRef = useRef<HTMLDivElement>(null)
  
  // Convert 0-11 value to rotation angle: -135° to +135° (270° total range)
  const rotation = (value / 11) * 270 - 135
  
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || isEditing) return
    
    e.preventDefault()
    setIsDragging(true)
    setDragStartY(e.clientY)
    setDragStartValue(value)
  }
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !knobRef.current) return
    
    const rect = knobRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    
    const dy = e.clientY - centerY
    const dx = e.clientX - centerX
    
    // Determine which drag mode to use based on movement
    const horizontalDistance = Math.abs(dx)
    
    let newValue: number
    
    if (horizontalDistance > 20 || Math.abs(dy) > 20) {
      // Circular rotation mode (when mouse is away from center)
      const angle = Math.atan2(dy, dx) * (180 / Math.PI)
      // Normalize angle to 0-360 range, with 0° at right (3 o'clock)
      const normalizedAngle = ((angle + 90 + 360) % 360)
      
      // Map angle to value (270° range centered at top)
      // -135° (bottom-left) to +135° (bottom-right) maps to 0-11
      let mappedAngle = normalizedAngle
      if (mappedAngle > 225) {
        // Wrap around the bottom dead zone
        mappedAngle = mappedAngle - 360
      }
      
      // Convert to 0-1 range where -135° = 0, +135° = 1
      const ratio = (mappedAngle + 135) / 270
      newValue = Math.max(0, Math.min(11, ratio * 11))
    } else {
      // Vertical drag mode (linear adjustment)
      const delta = dragStartY - e.clientY // up = positive (increase)
      const sensitivity = 0.02
      newValue = dragStartValue + (delta * sensitivity)
      newValue = Math.max(0, Math.min(11, newValue))
    }
    
    onChange(newValue)
  }, [isDragging, dragStartY, dragStartValue, onChange])
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])
  
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])
  
  const handleValueClick = () => {
    if (disabled) return
    setIsEditing(true)
    setEditValue(value.toFixed(1))
  }
  
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value)
  }
  
  const handleEditSubmit = () => {
    const parsed = parseFloat(editValue)
    if (!isNaN(parsed)) {
      const clamped = Math.max(0, Math.min(11, parsed))
      onChange(clamped)
    }
    setIsEditing(false)
  }
  
  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleEditSubmit()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }
  
  return (
    <div className="knob-container">
      <div
        ref={knobRef}
        className={`knob ${disabled ? 'knob-disabled' : ''} ${isDragging ? 'knob-dragging' : ''}`}
        onMouseDown={handleMouseDown}
      >
        <div 
          className="knob-body" 
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className="knob-indicator" />
        </div>
      </div>
      
      <div className="knob-value-container">
        {isEditing ? (
          <input
            type="text"
            className="knob-value-input"
            value={editValue}
            onChange={handleEditChange}
            onBlur={handleEditSubmit}
            onKeyDown={handleEditKeyDown}
            autoFocus
            disabled={disabled}
          />
        ) : (
          <span 
            className={`knob-value ${disabled ? 'knob-value-disabled' : ''}`}
            onClick={handleValueClick}
          >
            {value.toFixed(1)}
          </span>
        )}
      </div>
      
      <label className="knob-label">{label}</label>
    </div>
  )
}
