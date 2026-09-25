import type { RigName } from "@/lib/constants";
import { slugify } from "@/lib/utils";

export type RigStatus = "active" | "maintenance" | "standby";

export interface RigDisplayMeta {
  slug: string;
  photo: string; // /public path
  status: RigStatus;
  statusLabel: string;
  statusDot: string; // tailwind bg-*
  statusBadge: "default" | "warning" | "secondary";
}

const PHOTOS: Record<RigName, string> = {
  "Discovery 1": "/rigs/discovery-1.jpg",
  "Virtue 1": "/rigs/virtue-1.jpg",
  "Jindal Star": "/rigs/jindal-star.jpg",
  "Jindal Explorer": "/rigs/jindal-explorer.jpg",
  "Jindal Pioneer": "/rigs/jindal-pioneer.jpg",
  "Jindal Supreme": "/rigs/jindal-supreme.jpg",
};

const STATUS_OVERRIDES: Partial<Record<RigName, RigStatus>> = {
  "Jindal Pioneer": "maintenance",
  "Jindal Supreme": "standby",
};

const STATUS_LABEL: Record<RigStatus, string> = {
  active: "ACTIVE",
  maintenance: "MAINTENANCE",
  standby: "STANDBY",
};

const STATUS_BADGE: Record<RigStatus, "default" | "warning" | "secondary"> = {
  active: "default",
  maintenance: "warning",
  standby: "secondary",
};

const STATUS_DOT: Record<RigStatus, string> = {
  active: "bg-brand-success",
  maintenance: "bg-brand-warning",
  standby: "bg-slate-400",
};

export function rigMetaFor(
  name: RigName,
  apiStatus?: string | null,
): RigDisplayMeta {
  const mapped: RigStatus =
    apiStatus === "operational"
      ? "active"
      : apiStatus === "maintenance"
        ? "maintenance"
        : apiStatus === "stacked" || apiStatus === "transit"
          ? "standby"
          : (STATUS_OVERRIDES[name] ?? "active");

  return {
    slug: slugify(name),
    photo: PHOTOS[name],
    status: mapped,
    statusLabel: STATUS_LABEL[mapped],
    statusDot: STATUS_DOT[mapped],
    statusBadge: STATUS_BADGE[mapped],
  };
}
