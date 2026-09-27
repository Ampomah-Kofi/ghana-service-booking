export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse space-y-4 pt-4">
      <div className="h-9 w-3/4 rounded-control bg-fill" />
      <div className="h-5 w-full rounded-control bg-fill" />
      <div className="h-5 w-2/3 rounded-control bg-fill" />
    </div>
  );
}
