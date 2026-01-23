interface ProgressBarProps {
  progress: number // 0.0 to 1.0
  label?: string
}

export default function ProgressBar({ progress, label }: ProgressBarProps) {
  const percentage = Math.round(progress * 100)
  
  return (
    <div className="progress-container">
      {label && <p className="progress-label">{label}</p>}
      <div className="progress-track">
        <div 
          className="progress-fill" 
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="progress-percentage">{percentage}%</p>
    </div>
  )
}
