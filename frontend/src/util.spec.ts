import { describe, expect, it } from "vitest";
import { getEpisodeInfo } from "./util";

describe("getEpisodeInfo", () => {
    const pubDate = "Thu, 18 Sep 2025 14:25:00 -0000";
    it("durationがHH:MM:SS形式の場合、そのまま表示されること", () => {
        const duration = "01:23:45";
        const result = getEpisodeInfo(pubDate, duration);
        expect(result).toBe("2025/9/18 ・ 01:23:45");
    });
    it("durationがS秒形式の場合、HH:MM:SS形式に変換されること", () => {
        // 例: "5025" (1時間23分45秒)
        const duration = "5025";
        const result = getEpisodeInfo(pubDate, duration);
        expect(result).toBe("2025/9/18 ・ 01:23:45");
    });
})