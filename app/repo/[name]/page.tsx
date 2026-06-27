import { notFound } from "next/navigation";
import { CommitList } from "@/components/CommitList";
import { getRepository, repositories } from "@/lib/mockData";

type RepoPageProps = {
  params: Promise<{ name: string }>;
};

export function generateStaticParams() {
  return repositories.map((repo) => ({ name: repo.name }));
}

export default async function RepoPage({ params }: RepoPageProps) {
  const { name } = await params;
  const repo = getRepository(decodeURIComponent(name));

  if (!repo) notFound();

  return (
    <div className="page-stack">
      <section className="hero-section compact" aria-labelledby="repo-title">
        <span className="section-number">01</span>
        <div>
          <p className="eyebrow">{repo.language}</p>
          <h1 id="repo-title">{repo.name}</h1>
          <p className="lede">{repo.description}</p>
        </div>
      </section>

      <section className="content-section" aria-labelledby="commit-list-title">
        <span className="section-number">02</span>
        <div>
          <div className="section-heading">
            <p className="eyebrow">Newest first</p>
            <h2 id="commit-list-title">Commits</h2>
          </div>
          <CommitList commits={repo.commits} />
        </div>
      </section>
    </div>
  );
}
