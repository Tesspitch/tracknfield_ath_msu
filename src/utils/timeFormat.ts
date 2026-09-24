/**
 * Parses a time string (e.g. "1:52.40" or "12.34") into total seconds.
 */
export function parseTime(timeStr: string | null | undefined): number | null {
  if (!timeStr || timeStr.trim() === '') return null;
  
  const trimmed = timeStr.trim();
  
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const seconds = parseFloat(parts[1]);
      if (!isNaN(minutes) && !isNaN(seconds)) {
        return (minutes * 60) + seconds;
      }
    }
  } else {
    const seconds = parseFloat(trimmed);
    if (!isNaN(seconds)) return seconds;
  }
  
  return null;
}

/**
 * Formats total seconds into a display string.
 * Example: 112.4 -> "1:52.40"
 * Example: 12.34 -> "12.34"
 */
export function formatTime(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds)) return '';

  if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(2);
    // padStart for seconds just in case it's < 10
    return `${minutes}:${seconds.padStart(5, '0')}`;
  }
  
  return totalSeconds.toFixed(2);
}
