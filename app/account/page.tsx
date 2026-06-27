import { githubUser, reinAccount } from "@/lib/mockData";

export default function AccountPage() {
  return (
    <div className="page-stack">
      <section className="hero-section account-hero" aria-labelledby="account-title">
        <span className="section-number">01</span>
        <div className="account-profile">
          <img src={githubUser.avatarUrl} alt="" />
          <div>
            <p className="eyebrow">Account</p>
            <h1 id="account-title">{githubUser.name}</h1>
            <p className="lede">@{githubUser.username}</p>
          </div>
        </div>
      </section>

      <section className="content-section" aria-labelledby="account-stats-title">
        <span className="section-number">02</span>
        <div>
          <div className="section-heading">
            <p className="eyebrow">{reinAccount.plan}</p>
            <h2 id="account-stats-title">Rein stats</h2>
          </div>
          <dl className="stats-grid">
            <div>
              <dt>Repos</dt>
              <dd>{reinAccount.stats.repositories}</dd>
            </div>
            <div>
              <dt>Commits</dt>
              <dd>{reinAccount.stats.commits}</dd>
            </div>
            <div>
              <dt>Agent commits</dt>
              <dd>{reinAccount.stats.agentCommits}</dd>
            </div>
            <div>
              <dt>Providers</dt>
              <dd>{reinAccount.stats.linkedProviders}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
