/**
 * Shared helper and utility functions.
 */

/**
 * Example utility function to format currency strings.
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}
