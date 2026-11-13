// Skeleton rail for loading states (matches vanilla skeletonRail)
export default function SkeletonRail({ n = 8 }: { n?: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skel skel-card" />
      ))}
    </>
  )
}
