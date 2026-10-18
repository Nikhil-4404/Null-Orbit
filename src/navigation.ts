/** Retired creator links recover to Object Studio without importing old documents. */
export function resolveAppLocation(currentHref: string) {
  const url = new URL(currentHref);
  const retiredQuery = ["world", "scene", "scenery"].some((key) =>
    url.searchParams.has(key),
  );
  const retiredRoute = url.hash === "#worlds" || (!url.hash && retiredQuery);
  for (const key of ["world", "scene", "scenery"]) url.searchParams.delete(key);
  if (retiredRoute) url.hash = "studio";
  return {
    href: url.href,
    studioOpen:
      url.hash === "#studio" || (!url.hash && url.searchParams.has("design")),
  };
}
