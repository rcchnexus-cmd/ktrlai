import { useEffect } from "react";
import AppShell from "../components/AppShell.jsx";
import { useApp } from "../context/AppContext.jsx";

export default function Training() {
  const { state, actions } = useApp();

  useEffect(() => {
    if (!state.training && !state.loading.training) {
      actions.loadTraining();
    }
  }, [actions, state.loading.training, state.training]);

  const training = state.training;

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      actions.uploadTrainingFile({
        name: file.name,
        type: file.type || "Document",
        size: `${Math.max(Math.round(file.size / 1024), 1)} KB`
      });
      event.target.value = "";
    }
  };

  return (
    <AppShell
      title="Training Policy"
      eyebrow="Govern"
      subtitle="Control model-learning permissions, approved datasets, source context, and licensing summaries."
    >
      {!training ? (
        <div className="loadingState">Loading training permissions...</div>
      ) : (
        <div className="trainingLayout">
          <section className="panel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Permissions</span>
                <h2>Control what systems may learn</h2>
              </div>
            </div>
            <div className="toggleList">
              <label className="toggleRow">
                <div>
                  <strong>Train AI on my data</strong>
                  <span>Allow approved models to learn from selected sources.</span>
                </div>
                <input
                  type="checkbox"
                  checked={training.trainOnData}
                  onChange={(event) => actions.updateTraining({ trainOnData: event.target.checked })}
                />
              </label>
              <label className="toggleRow">
                <div>
                  <strong>Allow AI to learn writing style</strong>
                  <span>Permit tone and style adaptation without exposing private files.</span>
                </div>
                <input
                  type="checkbox"
                  checked={training.writingStyle}
                  onChange={(event) => actions.updateTraining({ writingStyle: event.target.checked })}
                />
              </label>
              <label className="toggleRow">
                <div>
                  <strong>Dataset licensing</strong>
                  <span>Attach licensing terms to approved training datasets.</span>
                </div>
                <input
                  type="checkbox"
                  checked={training.datasetLicensing}
                  onChange={(event) => actions.updateTraining({ datasetLicensing: event.target.checked })}
                />
              </label>
              <label className="toggleRow">
                <div>
                  <strong>Personalization models</strong>
                  <span>Allow private personalization on user-approved data.</span>
                </div>
                <input
                  type="checkbox"
                  checked={training.personalizationModels}
                  onChange={(event) => actions.updateTraining({ personalizationModels: event.target.checked })}
                />
              </label>
            </div>
            <label className="privacySelect">
              Privacy level
              <select
                value={training.privacyLevel}
                onChange={(event) => actions.updateTraining({ privacyLevel: event.target.value })}
              >
                <option>Public</option>
                <option>Restricted</option>
                <option>Private</option>
              </select>
            </label>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Upload center</span>
                <h2>Text, blogs, and documents</h2>
              </div>
            </div>
            <label className="uploadBox">
              <input type="file" onChange={handleUpload} />
              <span>Drop files or select documents</span>
              <em>TXT, Markdown, PDF, DOCX mock workflow</em>
            </label>
            {training.uploads.length === 0 ? (
              <div className="emptyState compact">
                <strong>No training files uploaded</strong>
                <p>Add a text, blog, or document export to preview controlled training behavior.</p>
              </div>
            ) : (
              <div className="fileList">
                {training.uploads.map((file) => (
                  <article key={file.id}>
                    <strong>{file.name}</strong>
                    <span>
                      {file.type} / {file.size}
                    </span>
                    <em>{file.status}</em>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel outputPreview">
            <div>
              <span className="eyebrow">Output preview</span>
              <h2>Approved model behavior</h2>
            </div>
            <p>{training.preview}</p>
          </section>
        </div>
      )}
    </AppShell>
  );
}
