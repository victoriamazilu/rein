"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { repoPath } from "@/lib/types";

type AddRepositoryDialogProps = {
  open: boolean;
  onClose: () => void;
  defaultOrg?: string;
};

export function AddRepositoryDialog({ open, onClose, defaultOrg }: AddRepositoryDialogProps) {
  const router = useRouter();
  const { addRepository } = useWorkspace();
  const [url, setUrl] = useState(defaultOrg ? `${defaultOrg}/` : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) return null;

  function handleClose() {
    setError(null);
    setPending(false);
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const repo = addRepository(url);
      handleClose();
      router.push(repoPath(repo.org, repo.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add repository.");
      setPending(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={handleClose} role="presentation">
      <div
        className="dialog"
        role="dialog"
        aria-labelledby="add-repo-title"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <h2 id="add-repo-title">Add repository</h2>
          <p className="muted">Paste a clone URL or owner/repo — like <code>git clone</code>.</p>
        </div>

        <form className="dialog-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Repository URL</span>
            <input
              type="text"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://github.com/you/project.git"
              autoFocus
              required
            />
          </label>
          <p className="field-hint">
            Examples: <code>you/project</code>,{" "}
            <code>git@github.com:you/project.git</code>
          </p>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="dialog-actions">
            <button type="button" className="button-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="button-primary" disabled={pending}>
              {pending ? "Adding…" : "Add repository"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddRepositoryButton({
  label = "Add repository",
  defaultOrg,
}: {
  label?: string;
  defaultOrg?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="button-primary" onClick={() => setOpen(true)}>
        {label}
      </button>
      <AddRepositoryDialog
        open={open}
        onClose={() => setOpen(false)}
        defaultOrg={defaultOrg}
      />
    </>
  );
}
