import { RepoCard } from "@/components/RepoCard";
import { repositories } from "@/lib/mockData";

export default function HomePage() {
  return (
    <div className="page-stack">
      <section className="hero-section" aria-labelledby="home-title">
        <span className="section-number">01</span>
        <div>
          <p className="eyebrow">Repository memory</p>
          <h1 id="home-title">Rein turns commits into durable context.</h1>
          <p className="lede">
            Rein sits beside GitHub and keeps the intent, reasoning, and notes behind each
            change searchable for future agents and humans.
          </p>
        </div>
      </section>

      <section className="content-section" aria-labelledby="repo-grid-title">
        <span className="section-number">02</span>
        <div>
          <div className="section-heading">
            <p className="eyebrow">Your workspace</p>
            <h2 id="repo-grid-title">Rein repositories</h2>
          </div>
          <div className="repo-grid">
            {repositories.map((repo) => (
              <RepoCard repo={repo} key={repo.name} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
