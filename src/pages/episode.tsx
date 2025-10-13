import { useState, useEffect, useRef } from "react";
import "../App.css";
import { useLocation } from "react-router-dom";

interface Episode {
  title: string;
  audioUrl: string;
  description: string;
  pubDate: string;
  duration?: string;
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
  translation?: string;
  segments: { start: number; end: number; text: string }[];
}

export default function Episode() {
  const [selectedChannel, setSelectedChannel] = useState<Channel>({ id: 0, rss_url: "", title: "" });
  const [transcription, setTranscription] = useState<Transcription>({ original: "", translation: undefined, segments: [] });
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedEpisode, setSelectedEpisode] = useState<Episode>({ title: "", audioUrl: "", description: "", pubDate: ""});
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);

  const location = useLocation();
  const channel = location.state.channel as Channel| undefined;
  const episode = location.state.episode as Episode | undefined;

  useEffect(() => {
    if (channel) {
      setSelectedChannel(channel);
    } else {
      setError("チャンネル情報が見つかりません。チャンネル一覧からアクセスしてください。");
    }
    if (episode) {
      setSelectedEpisode(episode);
    } else {
      setError("エピソード情報が見つかりません。エピソード一覧からアクセスしてください。");
    }
  }, [channel, episode]);

  useEffect(() => {
    // 両方の情報が揃ってからAPIを呼び出す
    if (selectedEpisode.audioUrl && selectedChannel.id !== 0) {
      fetchPreSavedTranscription(selectedEpisode);
    }
  }, [selectedEpisode, selectedChannel]);

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

  const fetchPreSavedTranscription = async (episode: Episode) => {
    setLoading(true);
    setError("");
    setTranscription({ original: "", translation: "", segments: [] });

    const requestData = { episode, channel: selectedChannel };

    try {
      const response = await fetch(`${url}get-saved-transcription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();
      if (response.ok && data.transcription) {
        setTranscription(data.transcription);
        setIsSaved(true);
      } else {
        setIsSaved(false);
      }
    } catch (err) {
      setError("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const fetchNewTranscription = async (episode: Episode) => {
    setLoading(true);
    setError("");
    setTranscription({ original: "", translation: "", segments: [] });

    try {
      const response = await fetch(`${url}get-new-transcription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode, channel: selectedChannel })
      });

      const data = await response.json();
      if (response.ok) {
        setTranscription(data.transcription);
        setIsSaved(true);
      } else {
        setIsSaved(false);
        setError(data.error || "文字起こしに失敗しました");
      }
    } catch (err) {
      setError("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  //クリップボードにコピー関数
  const copyToClipboard = (text: string | undefined) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
  };

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
      <h1 className="app-title">{`${selectedEpisode.title}`}</h1>

      {!isSaved && <button
        className="primary-button"
        onClick={() => fetchNewTranscription(selectedEpisode)}
        disabled={loading}
      >
        {loading ? "実行中..." : "文字起こし実行"}
      </button>}

      {error && <p className="error-message">⚠️ {error}</p>}

      { (isSaved && transcription.translation && transcription.original) &&  (
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
              onClick={() => copyToClipboard(transcription.original)}
            >
              クリップボードにコピー
            </button>
          </div>
        )}

        {isSaved && transcription.translation && (
          <div className="translation-section">
            <h2>翻訳結果</h2>
            <textarea
              className="translation-textarea"
              value={transcription.translation}
              readOnly
            />
            <button
              className="copy-button"
              onClick={() => copyToClipboard(transcription.translation)}
            >
              クリップボードにコピー
            </button>
          </div>
        )}
        </details>
      </div>
    )}

      {selectedEpisode && selectedEpisode.audioUrl && (
        <div className="audio-player-fixed">
          <audio ref={audioPlayerRef} src={selectedEpisode.audioUrl} controls className="audio-player" />
        </div>
      )}

      <p></p> 
      { isSaved && transcription.segments.length > 0 && (
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
      )} 

    </div>
  );
}
