import { useState, useEffect, useRef } from "react";
import "./App.css";

interface Episode {
  title: string;
  audioUrl: string;
  description: string;
}

interface RssList {
  id: number;
  rss_url: string;
  title: string;
}

interface Transcription {
  original: string;
  translation: string;
  segments: { start: number; end: number; text: string }[];
}

export default function SpotifyToRSS() {
  const [rssList, setRssList] = useState<RssList[]>([]);
  const [rssUrl, setRssUrl] = useState("");
  const [newRssUrl, setNewRssUrl] = useState("");
  const [delRssId, setDelRssId] = useState("");
  const [transcription, setTranscription] = useState<Transcription>({ original: "", translation: "", segments: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedAudioUrl, setSelectedAudioUrl] = useState<string>("");
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
  }, [selectedAudioUrl]);

  // 環境変数をインポート
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const url = backendUrl;

  useEffect(() => {
    // サーバーからRSSリストを取得
    fetch(`${url}rss-list`)
      .then((response) => response.json())
      .then((data) => setRssList(data.rssList || []))
      .catch((error) => console.error('Error fetching RSS list:', error));
  }, []);

  const fetchEpisodes = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${url}episodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rssUrl })
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

  const fetchTranscription = async (audioUrl: string) => {
    setLoading(true);
    setError("");
    setTranscription({ original: "", translation: "", segments: [] });

    try {
      const response = await fetch(`${url}transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl })
      });

      const data = await response.json();
      if (response.ok) {
        setTranscription(data.transcription);
      } else {
        setError(data.error || "文字起こしに失敗しました");
      }
    } catch (err) {
      setError("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const registerChannel = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${url}channel-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newRssUrl })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "登録に失敗しました"); 
      }
      fetch(`${url}rss-list`)
      .then((response) => response.json())
      .then((data) => setRssList(data.rssList || []))
      .catch((error) => console.error('Error fetching RSS list:', error));
    } catch (err) {
      setError("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  const deleteChannel = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${url}channel-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delRssId })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "削除に失敗しました"); 
      }
      fetch(`${url}rss-list`)
      .then((response) => response.json())
      .then((data) => setRssList(data.rssList || []))
      .catch((error) => console.error('Error deleting RSS list:', error));
    } catch (err) {
      setError("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  //クリップボードにコピー関数
  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcription.original);
  };

  // 現在の再生位置に基づいてセグメントを取得
  //const currentSegmentIndex = transcription.segments.findIndex(
  //  (seg) => currentTime >= seg.start && currentTime < seg.end
  //);

  useEffect(() => {
    if (transcription.segments.length === 0) return;

    const index = transcription.segments.findIndex(
      (seg) => currentTime >= seg.start && currentTime < seg.end
    );

    if (index !== -1) {
      setCurrentSegmentIndex(index);
    }
  }, [currentTime, transcription.segments]);
  
  useEffect(() => {
    const el = document.getElementById(`segment-${currentSegmentIndex}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentSegmentIndex]);

  return (
    <div className="app-container">
      <h1 className="app-title">Podcast Transcriber</h1>
      <div className="rss-section">
      <h2>Podcastチャンネルを選択</h2>
        <div className="pre-registered-rss-section">
          <h2>登録済のチャンネルから選択</h2>
          <select 
            className="rss-dropdown"
            value={rssUrl}
            onChange={(e) => setRssUrl(e.target.value)}
          >
            <option value="">チャンネルを選択</option>
            {rssList.map((rss, index) => (
              <option key={index} value={rss.rss_url}>
                {rss.title}
              </option>
            ))}
          </select>
          <button
            className="primary-button"
            onClick={fetchEpisodes}
            disabled={!rssUrl || loading}
          >
            {loading ? "実行中..." : "エピソード取得"}
          </button>
        </div>
        <div className="new-rss-section">
          <details>
          <summary><h2>
            新しいチャンネルを登録<span className="icon"></span>
          </h2></summary>
          <input
            type="text"
            className="w-full p-2 border rounded mb-4"
            placeholder="RSSフィードのURLを入力"
            value={newRssUrl}
            onChange={(e) => setNewRssUrl(e.target.value)}
          />
          <button
            className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
            onClick={registerChannel}
            disabled={!newRssUrl || loading}
          >
            {loading ? "実行中..." : "追加"}
          </button>
          </details>
        </div>
        <div className="new-rss-section">
          <details>
          <summary><h2>
            登録済のチャンネルを削除<span className="icon"></span>
          </h2></summary>
          <select 
            className="rss-dropdown"
            value={delRssId}
            onChange={(e) => setDelRssId(e.target.value)}
          >
            <option value="">チャンネルを選択</option>
            {rssList.map((rss, index) => (
              <option key={index} value={rss.id}>
                {rss.title}
              </option>
            ))}
          </select>
          <button
            className="primary-button"
            onClick={deleteChannel}
            disabled={!delRssId || loading}
          >
            {loading ? "実行中..." : "チャンネル削除"}
          </button>
          </details>
        </div>
      </div>

      { episodes.length > 0 && (<div className="episode-section">
        <h2>エピソードを選択</h2>
        <select
          className="episode-dropdown"
          onChange={(e) => setSelectedAudioUrl(e.target.value)}
        >
          <option value="">エピソードを選択</option>
          {episodes.map((episode) => (
            <option key={episode.audioUrl} value={episode.audioUrl}>
              {episode.title}
            </option>
          ))}
        </select>
        <button
          className="primary-button"
          onClick={() => fetchTranscription(selectedAudioUrl)}
          disabled={loading}
        >
          {loading ? "実行中..." : "文字起こし実行"}
        </button>
      </div>)}

      {error && <p className="error-message">⚠️ {error}</p>}

      { (transcription.translation && transcription.original) &&  (
        <div className="result-detail">
        <details>
          <summary><h2>
            結果詳細<span className="icon"></span>
          </h2></summary>
        {transcription.original && (
          <div className="transcription-section">
            <h2>文字起こし結果</h2>
            <textarea
              className="transcription-textarea"
              value={transcription.original}
              readOnly
            />
            <button
              className="copy-button"
              onClick={() => copyToClipboard()}
            >
              クリップボードにコピー
            </button>
          </div>
        )}

        {transcription.translation && (
          <div className="translation-section">
            <h2>翻訳結果</h2>
            <textarea
              className="translation-textarea"
              value={transcription.translation}
              readOnly
            />
            <button
              className="copy-button"
              onClick={() => copyToClipboard()}
            >
              クリップボードにコピー
            </button>
          </div>
        )}
        </details>
      </div>
    )}

      {transcription.segments.length > 0 && (
        <div className="audio-player-section">
          <h2>エピソードを再生</h2>
          <audio ref={audioPlayerRef} src={selectedAudioUrl} controls className="audio-player" />
        </div>
      )}

      <p></p>
      <div className="transcription-flow">
        {transcription.segments.map((seg, i) => (
          <div
            key={i}
            id={`segment-${i}`}
            className={i === currentSegmentIndex ? "bg-yellow-200" : ""}
          >
            {seg.text}
          </div>
        ))}
      </div>

    </div>
  );
}
