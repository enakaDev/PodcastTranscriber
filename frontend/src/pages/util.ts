export const getEpisodeInfo = (pubDate: string, duration?: string) => {
    const date = new Date(pubDate).toLocaleDateString('ja-JP');
    const dur = duration
        ? /:/.test(duration) || Number.isNaN(Number(duration))
            ? duration
            : `${Math.floor(Number(duration) / 3600)
                    .toString()
                    .padStart(
                        2,
                        "0",
                    )}:${Math.floor((Number(duration) % 3600) / 60)}:${(Number(duration) % 60).toString().padStart(2, "0")}`
        : "不明";
    return `${date} ・ ${dur}`;
};
