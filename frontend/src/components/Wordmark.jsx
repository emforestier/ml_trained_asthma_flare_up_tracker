// The app's name as a logo: "Breezy" with a small wind swoosh, and an optional tagline.
import { APP_NAME, APP_TAGLINE } from '../config';

export default function Wordmark({ size = 'large', tone = 'light', tagline = false }) {
  return (
    <div className={`wordmark ${size} ${tone}`}>
      <span className="wordmark-name">
        <svg className="wordmark-swoosh" viewBox="0 0 32 24" aria-hidden="true">
          <path d="M3 8 h15 a4 4 0 1 0 -4 -4" />
          <path d="M3 14 h22 a4 4 0 1 1 -4 4" />
          <path d="M3 20 h9" />
        </svg>
        {APP_NAME}
      </span>
      {tagline && <span className="wordmark-tagline">{APP_TAGLINE}</span>}
    </div>
  );
}
