import { Bone, SkeletonScreen } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScreen label="Loading calendar">
      <div className="mb-4 flex items-center justify-between pt-3">
        <Bone className="h-9 w-40" />
        <div className="flex gap-2">
          <Bone className="size-11 rounded-full" />
          <Bone className="h-11 w-18 rounded-full" />
          <Bone className="size-11 rounded-full" />
        </div>
      </div>
      <Bone className="mb-4 h-9 rounded-full" />
      <Bone className="h-112 rounded-card" />
    </SkeletonScreen>
  );
}
