import { Bone, SkeletonScreen } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScreen label="Loading calendar">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 pt-3">
        <Bone className="h-9 w-40" />
      </div>
      <Bone className="mb-4 h-9 rounded-full" />
      <Bone className="h-112 rounded-card" />
    </SkeletonScreen>
  );
}
