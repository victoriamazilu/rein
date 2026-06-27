import { RepoView } from "@/components/RepoView";

type RepoPageProps = {
  params: Promise<{ org: string; repo: string }>;
};

export default async function RepoPage({ params }: RepoPageProps) {
  const { org, repo } = await params;
  return (
    <RepoView orgSlug={decodeURIComponent(org)} repoName={decodeURIComponent(repo)} />
  );
}
