import { Bone, SkeletonList, SkeletonScreen, SkeletonTitle } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScreen label="Loading clients">
      <SkeletonTitle />
      <Bone className="mb-4 h-12 rounded-full" />
      <SkeletonList rows={6} />
    </SkeletonScreen>
  );
}
