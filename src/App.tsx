import { useState, useEffect } from "react";

interface Episode {
  title: string;
  audioUrl: string;
  description: string;
}

interface RssList {
  name: string;
  url: string;
}

interface Transcription {
  original: string;
  translation: string;
}

export default function SpotifyToRSS() {
  const [rssList, setRssList] = useState<RssList[]>([]);
  const [rssUrl, setRssUrl] = useState("");
  const [transcription, setTranscription] = useState<Transcription>({ original: "", translation: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedAudioUrl, setSelectedAudioUrl] = useState<string>("");

  const url = "https://backend.transcriber.workers.dev/"
  //const url = "http://localhost:8787/"

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
    setTranscription({ original: "", translation: "" });

    //const url = "https://transcriber.workers.dev/"
    const url = "http://localhost:8787/"

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

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow-lg rounded-xl">
      <h2 className="text-xl font-bold mb-4">Podcast 文字起こし</h2>
      <h3>RSSフィードを選択</h3>
      <select 
        value={rssUrl}
        onChange={(e) => setRssUrl(e.target.value)}
      >
        <option value="">RSSフィードを選択</option>
        {rssList.map((rss, index) => (
          <option key={index} value={rss.url}>
            {rss.name}
          </option>
        ))}
      </select>
      <button
        className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
        onClick={fetchEpisodes}
        disabled={!rssUrl || loading}
      >
        {loading ? "実行中..." : "エピソード取得"}
      </button>
      <div>
      <h3>新しいRSSフィードを入力</h3>
      <input
        type="text"
        className="w-full p-2 border rounded mb-4"
        placeholder="新しいRSSフィードのURLを入力"
        value={rssUrl}
        onChange={(e) => setRssUrl(e.target.value)}
      />
      <button
        className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
        onClick={fetchEpisodes}
        disabled={!rssUrl || loading}
      >
        {loading ? "実行中..." : "エピソード取得"}
      </button>
      {error && <p className="text-red-500 mt-4">⚠️ {error}</p>}
      </div>
      <div>
        <h3>エピソードを選択:</h3>
        <select
          className="w-full p-2 border rounded mb-4"
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
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
          onClick={() => {
            fetchTranscription(selectedAudioUrl);
          }}
          disabled={loading}
        >
          {loading ? "実行中..." : "文字起こし実行"}
        </button>
      </div>
      {transcription && (
        <div className="mt-4">
          <h3>文字起こし結果:</h3>
          <textarea
            className="w-full p-2 border rounded mb-4"
            value={transcription.original}
            readOnly
            rows={10}
          />
        </div>
      )}
      {transcription && (
        <div className="mt-4">
          <h3>翻訳結果:</h3>
          <textarea
            className="w-full p-2 border rounded mb-4"
            value={transcription.translation}
            readOnly
            rows={10}
          />
        </div>
      )}
    </div>
  );
}
