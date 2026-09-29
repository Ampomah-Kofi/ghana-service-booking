/** Plain words for admin_actions.action values. */
const LABELS: Record<string, string> = {
  "business.suspend": "Suspended a business",
  "business.restore": "Restored a business",
  "business.verification": "Verification decision",
  "user.suspend": "Suspended an account",
  "user.restore": "Restored an account",
  "review.moderate": "Moderated a review",
  "category.create": "Added a category",
  "category.update": "Changed a category",
};

export function actionLabel(action: string): string {
  return LABELS[action] ?? action;
}

/** Where the target of an action lives in the admin area (null when there's no page for it). */
export function targetHref(table: string, id: string): string | null {
  if (table === "businesses") return `/admin/businesses/${id}`;
  if (table === "profiles") return `/admin/users/${id}`;
  return null;
}
