export function formatDuration(seconds: number): string {
    const safe = Math.max(0, Math.floor(Number(seconds || 0)));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);

    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

export function formatHours(seconds: number): string {
    return `${(seconds / 3600).toFixed(1)}h`;
}
