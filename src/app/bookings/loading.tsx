import { Bone, SkeletonList, SkeletonScreen, SkeletonTitle } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScreen label="Loading your bookings">
      <SkeletonTitle />
      <Bone className="mb-2 ml-4 h-4 w-20" />
      <SkeletonList rows={2} />
      <Bone className="mb-2 ml-4 h-4 w-32" />
      <SkeletonList rows={3} />
    </SkeletonScreen>
  );
}
