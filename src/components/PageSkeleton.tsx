export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-5">
      <div className="h-6 w-44 rounded bg-[#e2e8f0]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-md border border-[#e5e7eb] bg-[#ffffff]" />
        ))}
      </div>
      <div className="h-72 rounded-md border border-[#e5e7eb] bg-[#ffffff]" />
    </div>
  )
}
