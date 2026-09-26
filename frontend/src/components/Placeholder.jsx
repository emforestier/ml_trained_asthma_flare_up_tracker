// Temporary screen body until each milestone replaces it. It loads the screen's endpoint
// through api.js so the mock switch can be checked on every tab.
import { useApi } from '../api';
import { USE_MOCK } from '../config';

export default function Placeholder({ title, milestone, loader, endpoint }) {
  const { data, loading } = useApi(loader);
  const source = USE_MOCK || data?.fromMock ? 'mock file' : 'backend';

  return (
    <section className="placeholder">
      <h1>{title}</h1>
      <p className="muted">Coming in the {milestone} milestone.</p>
      <div className="card">
        {loading ? (
          <p className="muted">Loading {endpoint}…</p>
        ) : (
          <p>
            Loaded <code>{endpoint}</code> from the {source} ({Object.keys(data || {}).length} fields).
          </p>
        )}
      </div>
    </section>
  );
}
