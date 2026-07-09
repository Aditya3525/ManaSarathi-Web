/**
 * ManaSarathi logo component — shows the correct logo for the current theme.
 * Uses CSS `dark:` selectors so it works with any class-based dark-mode setup.
 */
export function Logo({ className = 'h-8 w-8', alt = 'ManaSarathi' }: { className?: string; alt?: string }) {
  return (
    <>
      {/* ponytail: CSS-only theme switch avoids JS theme detection. Upgrade: use <picture> + prefers-color-scheme if needed. */}
      <img src="/logo-light.jpg" alt={alt} className={`${className} rounded-full object-cover dark:hidden`} />
      <img src="/logo-dark.jpg" alt={alt} className={`${className} rounded-full object-cover hidden dark:block`} />
    </>
  );
}
