import { OrgView } from "@/components/OrgView";

type OrgPageProps = {
  params: Promise<{ org: string }>;
};

export default async function OrgPage({ params }: OrgPageProps) {
  const { org } = await params;
  return <OrgView orgSlug={decodeURIComponent(org)} />;
}
