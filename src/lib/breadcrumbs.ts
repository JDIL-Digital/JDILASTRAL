import { RIGS } from "@/lib/constants";
import { slugify } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

/** Known top-level segments → friendly labels. */
const SEGMENT_LABELS: Record<string, string> = {
  fleet: "Fleet",
  rig: "Rig",
  "purchase-orders": "Purchase Orders",
  admin: "Administration",
  "bc-sync": "Business Central",
  projects: "Project",
  annexures: "Annexure",
  login: "Sign In",
};

/** Build slug → rig-name lookup once at module load. */
const RIG_NAME_BY_SLUG: Record<string, string> = Object.fromEntries(
  RIGS.map((name) => [slugify(name), name]),
);

function prettify(segment: string): string {
  if (RIG_NAME_BY_SLUG[segment]) return RIG_NAME_BY_SLUG[segment];
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  // Generic UUID / number id — abbreviate
  if (/^[0-9a-f-]{12,}$/i.test(segment)) return `#${segment.slice(0, 8)}`;
  return segment
    .split("-")
    .map((p) => (p.length ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}

/**
 * Derive breadcrumb chain from a pathname like `/rig/discovery-1`
 * → `[{ label: "Fleet", href: "/fleet" }, { label: "Discovery 1" }]`.
 *
 * Idempotent and dependency-free — safe to call on every render.
 */
export function breadcrumbsFromPath(pathname: string): Crumb[] {
  const parts = pathname.split("?")[0].split("/").filter(Boolean);
  if (parts.length === 0) return [];

  // Special-case the dashboard "home" so the bar reads "Fleet / Overview"
  // rather than just "Fleet".
  if (parts.length === 1 && parts[0] === "fleet") {
    return [
      { label: "Fleet", href: "/fleet" },
      { label: "Overview" },
    ];
  }

  // Single-segment pages get a friendly two-crumb chain.
  if (parts.length === 1) {
    return [{ label: prettify(parts[0]) }];
  }

  // Rig detail → Fleet › <Rig Name>
  if (parts[0] === "rig" && parts[1]) {
    return [
      { label: "Fleet", href: "/fleet" },
      { label: prettify(parts[1]) },
    ];
  }

  // /projects/<projectId>/annexures/<annexureId>
  if (parts[0] === "projects" && parts[2] === "annexures") {
    const projectId = parts[1];
    const rigSlug = projectId.replace(/-prj-\d+$/, "");
    return [
      { label: "Fleet", href: "/fleet" },
      { label: prettify(rigSlug), href: `/rig/${rigSlug}` },
      { label: prettify(parts[3] ?? "") },
    ];
  }

  // Generic fallback — build a chain with hrefs that walk up the tree.
  const crumbs: Crumb[] = [];
  let acc = "";
  parts.forEach((p, i) => {
    acc += "/" + p;
    const isLast = i === parts.length - 1;
    crumbs.push({ label: prettify(p), href: isLast ? undefined : acc });
  });
  return crumbs;
}
