// Urgent-care screen. Deliberately plain: no companion, no game elements, fixed rule-based text.
import { Link } from 'react-router-dom';
import UrgentNotice from '../components/UrgentNotice';

export default function Emergency() {
  return (
    <main className="emergency">
      <UrgentNotice />
      <p className="emergency-note">This app can't assess emergencies. When in doubt, get help.</p>
      <Link to="/" className="emergency-back">
        Back to the app
      </Link>
    </main>
  );
}
