import { SkeletonResults, SkeletonScreen, SkeletonTitle } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonScreen label="Loading favourites">
      <SkeletonTitle />
      <SkeletonResults count={2} />
    </SkeletonScreen>
  );
}
