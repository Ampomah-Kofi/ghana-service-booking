import { Bone, SkeletonResults, SkeletonScreen } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScreen label="Searching">
      <Bone className="mb-5 h-12 rounded-full" />
      <Bone className="mb-2 h-9 w-48" />
      <Bone className="mb-5 h-4 w-24" />
      <SkeletonResults />
    </SkeletonScreen>
  );
}
