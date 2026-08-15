import { useNavigate } from 'react-router-dom';
import { PlusIcon } from '../ui/Icons';

export function FAB() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/report')}
      aria-label="File a report"
      className="fixed bottom-24 right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-rage text-paper shadow-[0_6px_0_rgba(23,21,18,.35)]"
      style={{ maxWidth: 480 }}
    >
      <PlusIcon size={26} />
    </button>
  );
}
