import { NavLink } from 'react-router-dom';
import { HomeIcon, MapIcon, RecordIcon, BellIcon, UserIcon } from '../ui/Icons';

const ITEMS = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/map', label: 'Map', Icon: MapIcon, end: false },
  { to: '/weekly', label: 'Record', Icon: RecordIcon, end: false },
  { to: '/alerts', label: 'Alerts', Icon: BellIcon, end: false, badge: true },
  { to: '/profile', label: 'You', Icon: UserIcon, end: false },
];

export function BottomNav() {
  return (
    <nav className="safe-bottom flex items-center justify-around border-t border-border-strong bg-paper-chip px-2 pb-3 pt-3">
      {ITEMS.map(({ to, label, Icon, end, badge }) => (
        <NavLink key={to} to={to} end={end} className="flex flex-col items-center gap-1">
          {({ isActive }) => (
            <>
              <span className={`relative ${isActive ? 'text-rage' : 'text-muted'}`}>
                <Icon size={24} />
                {badge && <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-rage" />}
              </span>
              <span className={`font-mono text-[10px] ${isActive ? 'font-bold text-ink' : 'text-muted'}`}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
