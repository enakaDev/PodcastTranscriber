import { useState, useEffect, useRef } from "react";
import "./App.css";

interface Episode {
  title: string;
  audioUrl: string;
  description: string;
}

interface Channel {
  id: number;
  rss_url: string;
  title: string;
  image_url?: string;
  description?: string;
}

interface Transcription {
  original: string;
  translation: string;
  segments: { start: number; end: number; text: string }[];
}

export default function Episodes() {
  const [channelList, setChannelList] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel>({ id: 0, rss_url: "", title: "" });
  const [newRssUrl, setNewRssUrl] = useState("");
  const [delRssId, setDelRssId] = useState("");
  const [transcription, setTranscription] = useState<Transcription>({ original: "", translation: "", segments: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode>({ title: "", audioUrl: "", description: "" });
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const audio = audioPlayerRef.current;
    if (!audio) return;

    const handler = () => {
      setCurrentTime(audio.currentTime);
    };
    audio.addEventListener("timeupdate", handler);
    return () => audio.removeEventListener("timeupdate", handler);
  }, [selectedEpisode]);

  // 環境変数をインポート
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const url = backendUrl;

  useEffect(() => {
    // サーバーからRSSリストを取得
    fetch(`${url}channel-list`)
      .then((response) => response.json())
      .then((data) => setChannelList(data.channelList || []))
      .catch((error) => console.error('Error fetching channel list:', error));
  }, []);

  const fetchEpisodes = async () => {
    setLoading(true);
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
        setError(data.error || "エピソードの取得に失敗しました");
      }
    } catch (err) {
      setError("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const el = document.getElementById(`segment-${currentSegmentIndex}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentSegmentIndex]);

  return (
    <div className="app-container">
      <h1 className="app-title">Podcast Transcriber</h1>
      { episodes.length > 0 && (<div className="episode-section">
        <h2>エピソードを選択</h2>
        <select
          className="episode-dropdown"
          onChange={(e) => {
            const selectedEpisode = episodes.find((episode) => episode.audioUrl === e.target.value);
            if (selectedEpisode) {
              setSelectedEpisode(selectedEpisode);
            }
          }}
        >
          <option value="">エピソードを選択</option>
          {episodes.map((episode) => (
            <option key={episode.audioUrl} value={episode.audioUrl}>
              {episode.title}
            </option>
          ))}
        </select>
      </div>)}

      {error && <p className="error-message">⚠️ {error}</p>}

    </div>
  );
}
