export async function shareIssue(publicId: string, title: string): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = `${window.location.origin}/i/${encodeURIComponent(publicId)}`;
  if (navigator.share) {
    try {
      await navigator.share({ title, text: title, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      throw error;
    }
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return 'copied';
    } catch {
      // Fall through for WebViews and non-secure origins that deny Clipboard API access.
    }
  }

  const input = document.createElement('textarea');
  input.value = url;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Could not copy issue link.');
  return 'copied';
}
