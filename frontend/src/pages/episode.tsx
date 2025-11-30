import { useState, useEffect, useRef } from "react";
import "../App.css";
import { Link, useLocation } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";

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
	translation?: string[];
	segments: { start: number; end: number; text: string }[];
}

export default function Episode() {
	const [selectedChannel, setSelectedChannel] = useState<Channel>({
		id: 0,
		rss_url: "",
		title: "",
	});
	const [transcription, setTranscription] = useState<Transcription>({
		original: "",
		translation: [],
		segments: [],
	});
	const [isSaved, setIsSaved] = useState<boolean>(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [selectedEpisode, setSelectedEpisode] = useState<Episode>({
		title: "",
		audioUrl: "",
		description: "",
		pubDate: "",
	});
	const [currentTime, setCurrentTime] = useState(0);
	const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
	const [shouldTranslate, setShouldTranslate] = useState(true);
	const [activeTab, setActiveTab] = useState<"transcription" | "translation">("transcription");

	const location = useLocation();
	const channel = location.state.channel as Channel | undefined;
	const episode = location.state.episode as Episode | undefined;

	useEffect(() => {
		if (channel) {
			setSelectedChannel(channel);
		} else {
			setError(
				"チャンネル情報が見つかりません。チャンネル一覧からアクセスしてください。",
			);
		}
		if (episode) {
			setSelectedEpisode(episode);
		} else {
			setError(
				"エピソード情報が見つかりません。エピソード一覧からアクセスしてください。",
			);
		}
	}, [channel, episode]);

	useEffect(() => {
		// 両方の情報が揃ってからAPIを呼び出す
		if (selectedEpisode.audioUrl && selectedChannel.id !== 0) {
			fetchPreSavedTranscription(selectedEpisode);
		}
	}, [selectedEpisode, selectedChannel]);

	const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
	const wakeLockRef = useRef<WakeLockSentinel | null>(null);

	useEffect(() => {
		const audio = audioPlayerRef.current;
		if (!audio) return;

		console.log('[Wake Lock] Initializing Wake Lock listeners');
		console.log('[Wake Lock] Navigator.wakeLock available:', 'wakeLock' in navigator);

		const requestWakeLock = async () => {
			try {
				if ('wakeLock' in navigator) {
					if (wakeLockRef.current) {
						console.log('[Wake Lock] Already active, skipping request');
						return;
					}
					const wakeLock = await navigator.wakeLock!.request('screen');
					wakeLockRef.current = wakeLock;
					console.log('[Wake Lock] ✓ Activated successfully');

					wakeLock.addEventListener('release', () => {
						console.log('[Wake Lock] Released by system');
					});
				} else {
					console.warn('[Wake Lock] ✗ API not supported in this browser');
				}
			} catch (err: any) {
				console.error('[Wake Lock] ✗ Request failed:', err.name, err.message);
			}
		};

		const releaseWakeLock = async () => {
			try {
				if (wakeLockRef.current) {
					await wakeLockRef.current.release();
					wakeLockRef.current = null;
					console.log('[Wake Lock] ✓ Released manually');
				}
			} catch (err) {
				console.error('[Wake Lock] Release error:', err);
			}
		};

		const handlePlay = () => {
			console.log('[Wake Lock] Audio play event triggered');
			requestWakeLock();
		};

		const handlePause = () => {
			console.log('[Wake Lock] Audio pause event triggered');
			releaseWakeLock();
		};

		const handleTimeUpdate = () => {
			setCurrentTime(audio.currentTime);
		};

		const handleVisibilityChange = () => {
			console.log('[Wake Lock] Visibility changed:', document.visibilityState);
			if (document.visibilityState === 'visible' && !audio.paused) {
				console.log('[Wake Lock] Page visible and audio playing, re-requesting');
				requestWakeLock();
			}
		};

		audio.addEventListener('play', handlePlay);
		audio.addEventListener('pause', handlePause);
		audio.addEventListener('ended', handlePause);
		audio.addEventListener('timeupdate', handleTimeUpdate);
		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			console.log('[Wake Lock] Cleaning up');
			audio.removeEventListener('play', handlePlay);
			audio.removeEventListener('pause', handlePause);
			audio.removeEventListener('ended', handlePause);
			audio.removeEventListener('timeupdate', handleTimeUpdate);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			releaseWakeLock();
		};
	}, [selectedEpisode]);

	// 環境変数をインポート
	const backendUrl = import.meta.env.VITE_BACKEND_URL;
	const url = backendUrl;

	const fetchPreSavedTranscription = async (episode: Episode) => {
		setLoading(true);
		setError("");
		setTranscription({ original: "", translation: [], segments: [] });

		const requestData = { episode, channel: selectedChannel };

		try {
			const response = await fetch(`${url}main/get-saved-transcription`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestData),
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
		setTranscription({ original: "", translation: [], segments: [] });

		try {
			const response = await fetch(`${url}main/get-new-transcription`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ episode, channel: selectedChannel, shouldTranslate }),
			});

			const data = await response.json();
			if (response.ok) {
				setTranscription(data.transcription);
				setIsSaved(true);
				if (!data.transcription.translation) {
					setError("翻訳に失敗しました");
				}
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
			(seg) => currentTime >= seg.start && currentTime < seg.end,
		);

		if (index !== -1) {
			setCurrentSegmentIndex(index);
		}
	}, [currentTime, transcription.segments]);

	useEffect(() => {
		const el = document.getElementById(`segment-${currentSegmentIndex}`);
		el?.scrollIntoView({ behavior: "smooth", block: "center" });
	}, [currentSegmentIndex]);

	const breadcrumbItems = [
		{ label: "ホーム", path: "/" },
		{
			label: selectedChannel.title || "エピソード一覧",
			path: "/channel",
			state: { channel: selectedChannel },
		},
		{ label: selectedEpisode.title || "エピソード詳細", active: true },
	];

	return (
		<div className="app-container">
			<div className="app-header">
				<Breadcrumb items={breadcrumbItems} />
				<div className="mypage-link">
					<Link to="/myPage">
					マイページ
					</Link>
				</div>
			</div>
			<h2 className="app-title">{`${selectedEpisode.title}`}</h2>

			<div style={{ display: "flex", gap: "15px", alignItems: "center", justifyContent: "center" }}>
				<button
					className="primary-button"
					onClick={() => fetchNewTranscription(selectedEpisode)}
					disabled={loading}
				>
					{loading ? "実行中..." : "文字起こし実行"}
				</button>
				<label className="checkbox-label">
					<input
						type="checkbox"
						className="custom-checkbox"
						checked={shouldTranslate}
						onChange={(e) => setShouldTranslate(e.target.checked)}
					/>
					<span className="checkbox-text">翻訳結果を取得する</span>
				</label>
			</div>

			{error && <p className="error-message">⚠️ {error}</p>}

			<p></p>

			{isSaved && transcription.translation && transcription.original && (
				<div className="result-detail">
					<details>
						<summary>
							<h2>
								結果詳細<span className="icon"></span>
							</h2>
						</summary>
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
									value={transcription.translation.join(" ")}
									readOnly
								/>
								<button
									className="copy-button"
									onClick={() => copyToClipboard(transcription.translation?.join(" "))}
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
					<audio
						ref={audioPlayerRef}
						src={selectedEpisode.audioUrl}
						controls
						className="audio-player"
					/>
				</div>
			)}

			<p></p>

			{/* タブ表示（モバイル用） */}
			{isSaved && transcription.translation && transcription.translation.length > 0 && (
				<div className="tabs-container-mobile">
					<button
						className={`tab-button ${activeTab === "transcription" ? "active" : ""}`}
						onClick={() => setActiveTab("transcription")}
					>
						文字起こし
					</button>
					<button
						className={`tab-button ${activeTab === "translation" ? "active" : ""}`}
						onClick={() => setActiveTab("translation")}
					>
						翻訳
					</button>
				</div>
			)}

			{/* デスクトップ用の横並び表示 */}
			<div className={`episode-flow-desktop ${transcription.translation && transcription.translation.length > 0 ? "episode-flow" : ""}`}>
				{isSaved && transcription.segments.length > 0 && (
					<div className="transcription-flow">
						<div className="segments-container">
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
				)}
				{isSaved && transcription.translation && transcription.translation.length > 0 && (
					<div className="transcription-flow">
						<div className="segments-container">
							{transcription.translation.map((seg, i) => (
								<div
									key={i}
									id={`segment-${i}`}
									className={i === currentSegmentIndex ? "bg-yellow-200" : ""}
								>
									{seg}
								</div>
							))}
						</div>
					</div>
				)}
			</div>

			{/* モバイル用のタブコンテンツ表示 */}
			<div className="episode-flow-mobile">
				{isSaved && transcription.segments.length > 0 && activeTab === "transcription" && (
					<div className="transcription-flow">
						<div className="segments-container">
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
				)}
				{isSaved && transcription.translation && transcription.translation.length > 0 && activeTab === "translation" && (
					<div className="transcription-flow">
						<div className="segments-container">
							{transcription.translation.map((seg, i) => (
								<div
									key={i}
									id={`segment-${i}`}
									className={i === currentSegmentIndex ? "bg-yellow-200" : ""}
								>
									{seg}
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
