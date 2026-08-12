/**
 * Préférences de mouvement.
 * - respecte `prefers-reduced-motion`
 * - `?nomotion` dans l'URL : désactive les animations d'entrée
 *   (accessibilité, tests automatisés, captures d'écran)
 */
export const REDUCED_MOTION: boolean =
  typeof window !== 'undefined' &&
  (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    new URLSearchParams(window.location.search).has('nomotion'));
