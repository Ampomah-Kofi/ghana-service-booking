import { Bone, SkeletonList, SkeletonScreen, SkeletonTitle } from "@/components/ui/skeleton";

/** Shared by provider screens without their own placeholder. */
export default function Loading() {
  return (
    <SkeletonScreen label="Loading">
      <SkeletonTitle eyebrow />
      <div className="mb-6 grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} className="h-24 rounded-card" />
        ))}
      </div>
      <SkeletonList rows={4} />
    </SkeletonScreen>
  );
}
