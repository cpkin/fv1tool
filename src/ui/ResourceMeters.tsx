import { useMemo } from 'react'

import { useValidationStore } from '../store/validationStore'

const ResourceMeters = () => {
  const resourceUsage = useValidationStore((state) => state.resourceUsage)
  const diagnostics = useValidationStore((state) => state.diagnostics)

  const hasDiagnosticCode = useMemo(() => {
    return (codes: string[]) =>
      diagnostics.some(
        (diagnostic) =>
          (diagnostic.severity === 'warning' || diagnostic.severity === 'error') &&
          codes.some((code) => diagnostic.message.startsWith(code))
      )
  }, [diagnostics])

  const instructionWarning = resourceUsage.instructions.used > resourceUsage.instructions.max
  const delayWarning =
    resourceUsage.delayRam.used > resourceUsage.delayRam.max ||
    hasDiagnosticCode(['LINT-02', 'LINT-03', 'LINT-07'])
  const registerWarning =
    resourceUsage.registers.used > resourceUsage.registers.max ||
    hasDiagnosticCode(['LINT-04'])

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
      warning: instructionWarning,
    },
    {
      label: 'Delay RAM',
      ...resourceUsage.delayRam,
      meta: `${resourceUsage.delayRam.ms} ms`,
      warning: delayWarning,
    },
    {
      label: 'Registers',
      ...resourceUsage.registers,
      warning: registerWarning,
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
