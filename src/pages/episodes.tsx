import { useState, useEffect } from "react";
import "../App.css";
import { Link, useLocation } from "react-router-dom";

interface Episode {
  title: string;
  audioUrl: string;
  description: string;
  pubDate: string;
  duration?: number;
}

interface Channel {
  id: number;
  rss_url: string;
  title: string;
  image_url?: string;
  description?: string;
}

export default function Episodes() {
  const [selectedChannel, setSelectedChannel] = useState<Channel>({ id: 0, rss_url: "", title: "" });
  const [error, setError] = useState("");
  const [episodes, setEpisodes] = useState<Episode[]>([]);

  const location = useLocation();
  const channel = location.state as { channel: Channel } | undefined;

  useEffect(() => {
    if (channel) {
      setSelectedChannel(channel.channel);
    } else {
      setError("チャンネル情報が見つかりません。チャンネル一覧からアクセスしてください。");
    }
  }, [channel]);

  // selectedChannelが更新されたときにfetchEpisodesを実行
  useEffect(() => {
    if (selectedChannel.id !== 0 && selectedChannel.rss_url) {
      fetchEpisodes();
    }
  }, [selectedChannel]);

  // 環境変数をインポート
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const url = backendUrl;

  const fetchEpisodes = async () => {
    setError("");

    try {
      const response = await fetch(`${url}episodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: selectedChannel })
      });

      const data = await response.json();
      if (response.ok) {
        setEpisodes(data.episodes);
      } else {
        // エラーがオブジェクトの場合は文字列に変換
        const errorMessage = typeof data.error === 'object' 
          ? JSON.stringify(data.error) 
          : data.error || "エピソードの取得に失敗しました";
        setError(errorMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "エラーが発生しました";
      setError(errorMessage);
    }
  }

  const getEpisodeInfo = (pubDate: string, duration?: number) => {
    const date = new Date(pubDate).toLocaleDateString();
    const dur = duration ? `${Math.floor(duration / 60)}:${duration % 60}` : "不明";
    return `${date} ・ ${dur}`;
  }

  return (
    <div className="app-container">
      <h1 className="app-title">{`${selectedChannel.title}`}</h1>
      <div className="episodes-grid">
        {episodes.map((episode, index) => (
          <Link to={`/episode/${episode.title}`} state={{ episode }}
            key={`${index}-${episode.title}`} 
            className="episode-card"
          >
            <div className="episodeinfo">
              <h3 className="episode-title">{episode.title}</h3>
              <p className="episode-date-duration">{getEpisodeInfo(episode.pubDate, episode.duration)}</p>
              <p className="episode-description">
                {episode.description ? 
                  (episode.description.length > 300 
                    ? episode.description.substring(0, 300) + "..." 
                    : episode.description)
                  : "No description available"
                }
              </p>
            </div>
          </Link>
        ))}
      </div>

      {error && <p className="error-message">⚠️ {error}</p>}

    </div>
  );
}
