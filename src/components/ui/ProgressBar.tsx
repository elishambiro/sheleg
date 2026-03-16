interface ProgressBarProps {
  value: number
  label?: string
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  return (
    <div className="w-full">
      {label && <div className="text-xs text-gray-500 mb-1">{label}</div>}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-brand-700 h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 mt-0.5 text-left">{Math.round(value)}%</div>
    </div>
  )
}
