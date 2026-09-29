import { Bone, SkeletonScreen } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScreen label="Loading booking">
      <Bone className="mt-3 mb-5 h-64 rounded-card" />
      <div className="grid grid-cols-3 gap-2">
        <Bone className="h-12 rounded-full" />
        <Bone className="h-12 rounded-full" />
        <Bone className="h-12 rounded-full" />
      </div>
    </SkeletonScreen>
  );
}
