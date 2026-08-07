export function formatSmartDuration(hours: number): string {
  if (!hours) return '24 Jam';
  
  if (hours >= 168 && hours % 168 === 0) {
    return `${hours / 168} Minggu`;
  }
  if (hours >= 24 && hours % 24 === 0) {
    return `${hours / 24} Hari`;
  }
  return `${hours} Jam`;
}

export function formatSmartCountdown(diffMs: number): string {
  if (diffMs <= 0) return '0J 0M';

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const m = totalMinutes % 60;
  
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (totalHours >= 24) {
    const d = Math.floor(totalHours / 24);
    const h = totalHours % 24;
    return `${d} Hari ${h}J ${m}M`;
  } else {
    return `${totalHours}J ${m}M`;
  }
}
