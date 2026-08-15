import type { LocationPrecision, LocationVisibility } from './types';

const STORAGE_KEY = 'swaram:report-draft';

export interface ReportDraft {
  clientReportId: string;
  description: string;
  coordinates: {
    lat: number;
    lng: number;
    accuracyM?: number;
  };
  locationPrecision: LocationPrecision;
  locationVisibility: LocationVisibility;
}

export function saveReportDraft(draft: ReportDraft): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function readReportDraft(): ReportDraft | null {
  const value = localStorage.getItem(STORAGE_KEY);
  if (!value) return null;

  try {
    return JSON.parse(value) as ReportDraft;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearReportDraft(): void {
  localStorage.removeItem(STORAGE_KEY);
}
