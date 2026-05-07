export const TASK_CATEGORIES = [
  "infrastructure",
  "furniture_rentals",
  "technical",
  "services",
  "entertainment",
  "other"
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  infrastructure: "Setup and Infrastructure",
  furniture_rentals: "Tentage / Furniture",
  technical: "Technicals",
  services: "Services",
  entertainment: "Entertainment",
  other: "Other"
};
