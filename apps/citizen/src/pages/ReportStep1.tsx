import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { CameraIcon, MicIcon, TypeIcon, LocationPinIcon, ShieldCheckIcon } from '../components/ui/Icons';
import { currentUser } from '../lib/queries';
import { readReportDraft, saveReportDraft } from '../lib/report-draft';
import type { LocationPrecision, LocationVisibility } from '../lib/types';

export function ReportStep1() {
  const navigate = useNavigate();
  const previousDraft = readReportDraft();
  const [description, setDescription] = useState(previousDraft?.description ?? '');
  const [coordinates, setCoordinates] = useState(previousDraft?.coordinates ?? null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationPrecision, setLocationPrecision] = useState<LocationPrecision>(
    previousDraft?.locationPrecision ?? 'POINT',
  );
  const [locationVisibility, setLocationVisibility] = useState<LocationVisibility>(
    previousDraft?.locationVisibility ?? 'APPROXIMATE',
  );
  const [formError, setFormError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationError('Location is not available on this device.');
      return;
    }

    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCoordinates({ lat: coords.latitude, lng: coords.longitude, accuracyM: coords.accuracy });
        setLocating(false);
      },
      () => {
        setLocationError('Allow location access to route this report.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  useEffect(() => {
    if (!coordinates) requestLocation();
  }, []);

  function continueToPreview() {
    if (!description.trim()) {
      setFormError('Describe the problem before continuing.');
      textareaRef.current?.focus();
      return;
    }
    if (!coordinates) {
      setFormError('A location is required for every report.');
      requestLocation();
      return;
    }

    saveReportDraft({
      clientReportId: previousDraft?.clientReportId ?? crypto.randomUUID(),
      description: description.trim(),
      coordinates,
      locationPrecision,
      locationVisibility,
    });
    navigate('/report/confirm');
  }

  return (
    <AppShell nav={false}>
      <header className="flex items-center justify-between px-4 pb-3.5 pt-2">
        <button onClick={() => navigate('/')} className="font-mono text-[13px] text-muted-strong">
          Cancel
        </button>
        <span className="font-mono text-[13px] font-bold">Step 1 of 2</span>
        <span className="w-11" />
      </header>

      <div className="flex flex-col gap-4 px-5">
        <div>
          <h2 className="font-display text-[28px] leading-tight">What's the problem?</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-strong">
            Take a photo, or just speak. We'll handle the rest.
          </p>
        </div>

        <button
          onClick={() => textareaRef.current?.focus()}
          className="flex items-center gap-4 rounded-card bg-rage px-5 py-6 text-left text-paper shadow-[0_5px_0_rgba(23,21,18,.3)]"
        >
          <CameraIcon size={38} />
          <span>
            <span className="block font-mono text-lg font-bold">Take a photo</span>
            <span className="mt-1 block text-[13px] opacity-85">Photo upload follows in the media slice</span>
          </span>
        </button>

        <button
          onClick={() => textareaRef.current?.focus()}
          className="flex items-center gap-4 rounded-card border-[1.5px] border-ink bg-paper px-5 py-5 text-left"
        >
          <MicIcon size={34} />
          <span>
            <span className="block font-mono text-lg font-bold">Speak instead</span>
            <span className="mt-1 block text-[13px] text-muted">Voice transcription follows in the media slice</span>
          </span>
        </button>

        <button
          onClick={() => textareaRef.current?.focus()}
          className="flex items-center gap-4 rounded-card border-[1.5px] border-border-strong bg-paper px-5 py-5 text-left text-muted-strong"
        >
          <TypeIcon size={30} />
          <span className="font-mono text-[17px] font-bold">Type it out</span>
        </button>

        <textarea
          ref={textareaRef}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setFormError(null);
          }}
          maxLength={4000}
          rows={4}
          placeholder="Describe what happened…"
          className="w-full resize-none rounded-card border-[1.5px] border-border-strong bg-paper px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-rage"
        />

        <div className="flex items-center gap-3 rounded-card bg-paper-card2 px-4 py-3.5">
          <LocationPinIcon size={24} className="text-muted-strong" />
          <div className="flex-1">
            <div className="text-[14.5px]">
              {coordinates ? 'Phone location recorded' : locating ? 'Finding your location…' : 'Location required'}
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-muted">
              {coordinates
                ? `Accuracy about ${Math.round(coordinates.accuracyM ?? 0)} m · jurisdiction pending`
                : locationError ?? 'Used for routing; no ward boundary is assumed'}
            </div>
          </div>
          <button onClick={requestLocation} className="font-mono text-[11.5px] font-bold text-rage">
            Retry
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="font-mono text-[11px] text-muted">
            PROBLEM AREA
            <select
              value={locationPrecision}
              onChange={(event) => setLocationPrecision(event.target.value as LocationPrecision)}
              className="mt-1.5 w-full rounded-lg border border-border-strong bg-paper px-2 py-2 text-xs text-ink"
            >
              <option value="POINT">Exact point</option>
              <option value="AREA">Street / area</option>
              <option value="JURISDICTION">Jurisdiction-wide</option>
            </select>
          </label>
          <label className="font-mono text-[11px] text-muted">
            PUBLIC MAP
            <select
              value={locationVisibility}
              onChange={(event) => setLocationVisibility(event.target.value as LocationVisibility)}
              className="mt-1.5 w-full rounded-lg border border-border-strong bg-paper px-2 py-2 text-xs text-ink"
            >
              <option value="APPROXIMATE">Approximate</option>
              <option value="EXACT">Exact</option>
              <option value="PRIVATE">Private</option>
            </select>
          </label>
        </div>

        <div className="mb-1.5 mt-auto flex items-center gap-2.5 rounded-card bg-gov-bg px-4 py-3.5">
          <ShieldCheckIcon size={22} className="flex-none text-gov" />
          <div className="text-[13px] leading-relaxed text-gov-text">
            You post as <strong>{currentUser.handle}</strong>. Your name is never shown.
          </div>
        </div>
      </div>

      <div className="px-5 pb-6 pt-4">
        {formError && <p className="mb-2 text-sm text-rage">{formError}</p>}
        <Button onClick={continueToPreview} className="text-base">
          Next
        </Button>
      </div>
    </AppShell>
  );
}
