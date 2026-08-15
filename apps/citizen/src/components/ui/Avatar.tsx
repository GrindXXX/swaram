interface AvatarProps {
  initials: string;
  size?: number;
}

export function Avatar({ initials, size = 44 }: AvatarProps) {
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full border border-ink bg-paper-avatar font-mono font-bold text-ink"
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.24) }}
    >
      {initials}
    </div>
  );
}
