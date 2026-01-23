import { useMemo } from 'react'

import { useValidationStore } from '../store/validationStore'

const ResourceMeters = () => {
  const resourceUsage = useValidationStore((state) => state.resourceUsage)
  const diagnostics = useValidationStore((state) => state.diagnostics)

  const warningCount = useMemo(
    () => diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length,
    [diagnostics],
  )

  const meters: Array<{
    label: string
    used: number
    max: number
    meta?: string
    warning?: boolean
  }> = [
    {
      label: 'Instructions',
      ...resourceUsage.instructions,
    },
    {
      label: 'Delay RAM',
      ...resourceUsage.delayRam,
      meta: `${resourceUsage.delayRam.ms} ms`,
    },
    {
      label: 'Registers',
      ...resourceUsage.registers,
      warning: warningCount > 0,
    },
  ]

  return (
    <section className="meter-row">
      {meters.map((meter) => {
        const percent = Math.min(100, (meter.used / meter.max) * 100)
        return (
          <div
            key={meter.label}
            className={`meter-card${meter.warning ? ' warning' : ''}`}
          >
            <p className="meter-label">{meter.label}</p>
            <p className="meter-value">
              {meter.used} / {meter.max}{' '}
              {meter.meta ? <span className="meter-meta">{meter.meta}</span> : null}
            </p>
            <div className="meter-track">
              <span className="meter-fill" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )
      })}
    </section>
  )
}

export default ResourceMeters
