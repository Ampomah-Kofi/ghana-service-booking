export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading your account" className="animate-pulse">
      <div className="mb-6 h-9 w-1/2 rounded-control bg-fill" />
      <div className="mb-8 h-24 rounded-card bg-fill" />
      <div className="h-16 rounded-card bg-fill" />
    </div>
  );
}
