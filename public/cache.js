export function isFirstTimeUser() {
  const hasUsedBefore = JSON.parse(localStorage.getItem('hasUsedBefore') || 'false');
  if (!hasUsedBefore) {
    localStorage.setItem('hasUsedBefore', JSON.stringify(true));
  }
  return !hasUsedBefore;
}