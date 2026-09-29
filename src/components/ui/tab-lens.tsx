import { ViewTransition } from "react";

/**
 * The bright "lens" behind the selected tab or segment. It has a shared name, so on navigation it
 * slides from the old tab to the new one instead of jumping (React <ViewTransition>; browsers
 * without view transitions simply switch). ADR-0012.
 */
export function TabLens({ name, className = "rounded-full" }: { name: string; className?: string }) {
  return (
    <ViewTransition name={name} share="lens" default="none">
      <span aria-hidden="true" className={`glass-lens absolute inset-0 -z-10 ${className}`} />
    </ViewTransition>
  );
}
