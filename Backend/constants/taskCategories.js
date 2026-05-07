/** Task / spend categories for team assignments and employee bill uploads. */
const TASK_CATEGORIES = [
  "infrastructure",
  "furniture_rentals",
  "technical",
  "services",
  "entertainment",
  "other"
];

function isTaskCategory(value) {
  return TASK_CATEGORIES.includes(String(value));
}

module.exports = { TASK_CATEGORIES, isTaskCategory };
