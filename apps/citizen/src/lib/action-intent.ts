export type CitizenActionIntent = {
  issueId: string;
  action: 'follow' | 'comment' | 'facing';
  comment?: string;
};

const KEY = 'swaram:citizen-action-intent';

export function saveActionIntent(intent: CitizenActionIntent) {
  localStorage.setItem(KEY, JSON.stringify(intent));
}

export function readActionIntent(): CitizenActionIntent | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as CitizenActionIntent | null;
  } catch {
    return null;
  }
}

export function clearActionIntent() {
  localStorage.removeItem(KEY);
}
