/** Re-mounts on every navigation, so each screen eases in like a native app (reduced motion turns it off). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
