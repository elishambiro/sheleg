interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
}

export function EmptyState({ icon = '📂', title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12 text-center text-gray-400">
      <div className="text-5xl mb-3">{icon}</div>
      <div className="text-sm font-medium text-gray-500">{title}</div>
      {description && <div className="text-xs mt-1 max-w-48">{description}</div>}
    </div>
  )
}
