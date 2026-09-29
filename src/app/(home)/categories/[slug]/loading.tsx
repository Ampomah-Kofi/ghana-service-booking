import { Bone, SkeletonResults, SkeletonScreen, SkeletonTitle } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScreen label="Loading category">
      <SkeletonTitle />
      <div className="mb-5 flex gap-2">
        <Bone className="h-9 w-16 rounded-full" />
        <Bone className="h-9 w-20 rounded-full" />
        <Bone className="h-9 w-20 rounded-full" />
      </div>
      <SkeletonResults />
    </SkeletonScreen>
  );
}
