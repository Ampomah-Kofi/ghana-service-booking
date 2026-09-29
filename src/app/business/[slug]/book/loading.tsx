import { Bone, SkeletonScreen } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScreen label="Loading booking">
      <Bone className="mt-3 mb-6 h-5 w-24" />
      <Bone className="mb-2 h-3 w-20" />
      <Bone className="mb-5 h-1 w-full rounded-full" />
      <Bone className="mb-5 h-9 w-2/3" />
      <div className="mb-6 flex gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Bone key={i} className="h-18 w-14 shrink-0 rounded-card" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }, (_, i) => (
          <Bone key={i} className="h-12 rounded-full" />
        ))}
      </div>
    </SkeletonScreen>
  );
}
