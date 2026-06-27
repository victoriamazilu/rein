import Link from "next/link";
import type { OrganizationView } from "@/lib/types";
import { orgPath } from "@/lib/types";

export function OrgCard({ org }: { org: OrganizationView }) {
  return (
    <Link className="org-card" href={orgPath(org.slug)}>
      <span className="org-card-avatar" aria-hidden="true">
        {org.slug.slice(0, 1).toUpperCase()}
      </span>
      <div className="org-card-body">
        <h2>{org.name}</h2>
        <span className="muted">{org.repoCount} repositories</span>
      </div>
    </Link>
  );
}
