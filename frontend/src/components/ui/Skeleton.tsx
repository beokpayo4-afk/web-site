export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-mist ${className}`} />
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col rounded-3xl border border-line bg-white p-3" aria-hidden="true">
      <Skeleton className="aspect-square w-full rounded-2xl" />
      <Skeleton className="mt-4 h-3 w-20" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-full" />
      <Skeleton className="mt-6 h-8 w-24" />
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  )
}

export function ProductDetailsSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-2" aria-busy="true" aria-label="Loading product">
      <Skeleton className="aspect-square w-full rounded-4xl" />
      <div>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-10 w-3/4" />
        <Skeleton className="mt-6 h-20 w-full" />
        <Skeleton className="mt-8 h-10 w-36" />
        <Skeleton className="mt-4 h-12 w-48" />
      </div>
    </div>
  )
}
