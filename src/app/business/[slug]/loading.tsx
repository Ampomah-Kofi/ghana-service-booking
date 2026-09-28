import { Bone, SkeletonList, SkeletonScreen } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScreen label="Loading business">
      <Bone className="bleed-top -mx-5 mb-5 aspect-4/3 rounded-none sm:mx-0 sm:rounded-card md:mt-0" />
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1 space-y-2">
          <Bone className="h-7 w-3/4" />
          <Bone className="h-4 w-1/2" />
        </div>
        <Bone className="h-8 w-18 rounded-full" />
      </div>
      <Bone className="mb-6 h-14" />
      <div className="mb-7 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} className="mx-auto size-12 rounded-full" />
        ))}
      </div>
      <Bone className="mb-3 h-6 w-28" />
      <SkeletonList rows={3} />
    </SkeletonScreen>
  );
}
