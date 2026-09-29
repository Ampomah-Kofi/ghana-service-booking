import { Bone, SkeletonScreen, SkeletonTitle } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScreen label="Loading your account">
      <SkeletonTitle eyebrow width="w-52" />
      {[2, 1, 2].map((rows, i) => (
        <div key={i} className="mb-8">
          <Bone className="mb-2 ml-4 h-4 w-24" />
          <Bone className={`rounded-card ${rows === 1 ? "h-12" : "h-24"}`} />
        </div>
      ))}
    </SkeletonScreen>
  );
}
