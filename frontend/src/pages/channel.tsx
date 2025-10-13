import { useState, useEffect } from "react";
import "../App.css";
import { Link, useLocation } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import { getEpisodeInfo } from "../util";

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

export default function Channel() {
	const [selectedChannel, setSelectedChannel] = useState<Channel>({
		id: 0,
		rss_url: "",
		title: "",
	});
	const [error, setError] = useState("");
	const [episodes, setEpisodes] = useState<Episode[]>([]);
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 20;

	const location = useLocation();
	const channel = location.state as { channel: Channel } | undefined;

	useEffect(() => {
		if (channel) {
			setSelectedChannel(channel.channel);
		} else {
			setError(
				"チャンネル情報が見つかりません。チャンネル一覧からアクセスしてください。",
			);
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
				body: JSON.stringify({ channel: selectedChannel }),
			});

			const data = await response.json();
			if (response.ok) {
				setEpisodes(data.episodes);
			} else {
				// エラーがオブジェクトの場合は文字列に変換
				const errorMessage =
					typeof data.error === "object"
						? JSON.stringify(data.error)
						: data.error || "エピソードの取得に失敗しました";
				setError(errorMessage);
			}
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "エラーが発生しました";
			setError(errorMessage);
		}
	};

	// ページネーション用のロジック
	const totalPages = Math.ceil(episodes.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const currentEpisodes = episodes.slice(startIndex, endIndex);

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
	};

	const handlePrevPage = () => {
		if (currentPage > 1) {
			setCurrentPage(currentPage - 1);
		}
	};

	const handleNextPage = () => {
		if (currentPage < totalPages) {
			setCurrentPage(currentPage + 1);
		}
	};

	const handleFirstPage = () => {
		setCurrentPage(1);
	};

	const handleLastPage = () => {
		setCurrentPage(totalPages);
	};

	const breadcrumbItems = [
		{ label: "ホーム", path: "/" },
		{ label: selectedChannel.title || "エピソード一覧", active: true },
	];

	return (
		<div className="app-container">
			<Breadcrumb items={breadcrumbItems} />
			<h1 className="app-title">{`${selectedChannel.title}`}</h1>
			<div className="episodes-grid">
				{currentEpisodes.map((episode, index) => (
					<Link
						to={`/episode`}
						state={{ episode, channel: selectedChannel }}
						key={`${startIndex + index}-${episode.title}`}
						className="episode-card"
					>
						<div className="episodeinfo">
							<h3 className="episode-title">{episode.title}</h3>
							<p className="episode-date-duration">
								{getEpisodeInfo(episode.pubDate, episode.duration)}
							</p>
							<p className="episode-description">
								{episode.description
									? episode.description.length > 300
										? episode.description.substring(0, 300) + "..."
										: episode.description
									: "No description available"}
							</p>
						</div>
					</Link>
				))}
			</div>

			{/* ページネーション */}
			{totalPages > 1 && (
				<div className="pagination">
					<button
						className="pagination-btn"
						onClick={handleFirstPage}
						disabled={currentPage === 1}
					>
						最初へ
					</button>

					<button
						className="pagination-btn"
						onClick={handlePrevPage}
						disabled={currentPage === 1}
					>
						前へ
					</button>

					<div className="pagination-pages">
						{Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
							let pageNumber;
							if (totalPages <= 5) {
								pageNumber = i + 1;
							} else if (currentPage <= 3) {
								pageNumber = i + 1;
							} else if (currentPage >= totalPages - 2) {
								pageNumber = totalPages - 4 + i;
							} else {
								pageNumber = currentPage - 2 + i;
							}

							return (
								<button
									key={pageNumber}
									className={`pagination-page ${currentPage === pageNumber ? "active" : ""}`}
									onClick={() => handlePageChange(pageNumber)}
								>
									{pageNumber}
								</button>
							);
						})}
					</div>

					<button
						className="pagination-btn"
						onClick={handleNextPage}
						disabled={currentPage === totalPages}
					>
						次へ
					</button>

					<button
						className="pagination-btn"
						onClick={handleLastPage}
						disabled={currentPage === totalPages}
					>
						最後へ
					</button>
				</div>
			)}

			<div className="pagination-info">
				<p>
					{episodes.length}件中 {startIndex + 1}-
					{Math.min(endIndex, episodes.length)}件を表示
				</p>
			</div>

			{error && <p className="error-message">⚠️ {error}</p>}
		</div>
	);
}
