import { useState, useEffect } from "react";
import "../App.css";

interface Channel {
  id: number;
  rss_url: string;
  title: string;
  image_url?: string;
  description?: string;
}

export default function Channels() {
  const [channelList, setChannelList] = useState<Channel[]>([]);
  const [newRssUrl, setNewRssUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAddChannel, setShowAddChannel] = useState(false);

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
      fetch(`${url}channel-list`)
      .then((response) => response.json())
      .then((data) => setChannelList(data.channelList || []))
      .catch((error) => console.error('Error fetching RSS list:', error));
    } catch (err) {
      setError("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteChannel = async (channelId: number) => {
    if (!confirm("このチャンネルを削除してもよろしいですか？")) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${url}channel-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delRssId: channelId.toString() })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "削除に失敗しました"); 
      } else {
        // 削除成功時にチャンネルリストを更新
        fetch(`${url}channel-list`)
        .then((response) => response.json())
        .then((data) => setChannelList(data.channelList || []))
        .catch((error) => console.error('Error fetching channel list:', error));
      }
    } catch (err) {
      setError("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-container">
      <h1 className="app-title">Podcast Transcriber</h1>
      <div className="rss-section">
        <div className="channels-grid">
          {channelList.map((channel) => (
            <div key={channel.id} className="channel-card">
              <button 
                className="delete-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteChannel(channel.id);
                }}
                title={`Delete ${channel.title}`}
              >
                ×
              </button>
              <div className="channel-image">
                {channel.image_url ? (
                  <img src={channel.image_url} alt={channel.title} />
                ) : (
                  <div className="placeholder-image">
                    <span>🎙️</span>
                  </div>
                )}
              </div>
              <div className="channel-info">
                <h3 className="channel-title">{channel.title}</h3>
                <p className="channel-description">
                  {channel.description ? 
                    (channel.description.length > 100 
                      ? channel.description.substring(0, 100) + "..." 
                      : channel.description)
                    : "No description available"
                  }
                </p>
              </div>
            </div>
          ))}
          <div className="new-channel-card">
            <button 
              className={!showAddChannel ? "add-channel-button" : "add-channel-button-small"}
              onClick={(e) => {
                e.stopPropagation();
                setShowAddChannel(!showAddChannel);
              }}
              title={`Add new channel`}
            >
              { !showAddChannel ? "+" : "×"} 
            </button>
            { showAddChannel && (
              <div className="add-channel-form">
                <input
                  type="text"
                  placeholder="RSSフィードのURLを入力"
                  value={newRssUrl}
                  onChange={(e) => setNewRssUrl(e.target.value)}
                />
                <button
                  onClick={registerChannel}
                  disabled={!newRssUrl || loading}
                >
                  {loading ? "実行中..." : "追加"}
                </button>
              </div>
            )}
          </div>
        </div>

        {error && <p className="error-message">⚠️ {error}</p>}

      </div>
    </div>
  );
}
