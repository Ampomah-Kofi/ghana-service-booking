import { Bone, SkeletonCardRow, SkeletonScreen, SkeletonTitle } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScreen label="Loading Explore">
      <SkeletonTitle eyebrow width="w-36" />
      <Bone className="mb-3 h-12 rounded-full" />
      <div className="mb-8 flex gap-2">
        <Bone className="h-9 w-28 rounded-full" />
        <Bone className="h-9 w-40 rounded-full" />
      </div>
      <Bone className="mb-3 h-6 w-32" />
      <div className="mb-8 flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} className="size-20 rounded-card" />
        ))}
      </div>
      <SkeletonCardRow />
    </SkeletonScreen>
  );
}
