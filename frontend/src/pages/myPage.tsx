import { useState, useEffect } from "react";
import "../App.css";
import { getUserInfo } from "../auth";
import Breadcrumb from "../components/Breadcrumb";

type ApiKeys = {
	deepgram?: string;
	deepl?: string;
}

type UserInfo = {
	userId: string;
	email?: string;
	apiKey?: ApiKeys;
};

export default function MyPage() {
	const [error, setError] = useState("");
	const [userInfo, setUserInfo] = useState<UserInfo>({
		userId: ""
	});
	const [isEditing, setIsEditing] = useState(false);
	const [apiKeys, setApiKeys] = useState<ApiKeys>({
		deepgram: "",
		deepl: ""
	});

	// 環境変数をインポート
	const backendUrl = import.meta.env.VITE_BACKEND_URL;
	const url = backendUrl;

	useEffect(() => {
		fetchUserInfo();
	}, []);

	const fetchUserInfo = async () => {
		try {
			const userInfoRes = await getUserInfo();
			setUserInfo(userInfoRes);
			setApiKeys({
				deepgram: userInfoRes.apiKey?.deepgram,
				deepl: userInfoRes.apiKey?.deepl
			});
		} catch (err) {
			setError("ユーザー情報の取得に失敗しました");
		}
	}

	const handleEdit = () => {
		setIsEditing(true);
	}

	const handleCancel = () => {
		setIsEditing(false);
	}

	const handleSave = async () => {
		const res = await fetch(`${backendUrl}auth/saveApiKeys`, {
			method: "POST",
			credentials: "include",
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(apiKeys)
		});
		if (!res.ok) {
			setError("APIキーの保存に失敗しました");
			return;
		}
		setIsEditing(false);
	}

	const handleLogOut = async () => {
		try {
			await fetch(`${url}auth/logout`, {
				method: "GET",
				credentials: "include",
			});
			window.location.href = "/" 
		} catch (err) {
			setError("ログアウトに失敗しました");
		}
	}

	return (
		<div className="app-container">
			<div className="app-header">
				<Breadcrumb items={[{ label: "ホーム", path: "/" }]} />
				<div
					onClick={handleLogOut}
					className="logout-button"
				>
				ログアウト
				</div>
			</div>
			<h1 className="app-title">My Page</h1>
			<div className="user-info">
				<div className="user-info-row">
					<span className="user-info-label">ユーザーID:</span>
					<span className="user-info-value">{userInfo.userId}</span>
				</div>
				<div className="user-info-row">
					<span className="user-info-label">メールアドレス:</span>
					<span className="user-info-value">{userInfo.email}</span>
				</div>
			</div>

			<div className="api-keys-section">
				<div className="api-keys-header">
					<h2>APIキー</h2>
					{!isEditing && (
						<button onClick={handleEdit} className="edit-button">
							編集
						</button>
					)}
				</div>
				<div className="api-keys-form">
					<div className="form-row">
						<label className="form-label">DEEPGRAM APIキー:</label>
						<input
							type="text"
							className="form-input"
							value={apiKeys.deepgram}
							onChange={(e) => setApiKeys({...apiKeys, deepgram: e.target.value})}
							disabled={!isEditing}
						/>
					</div>
					<div className="form-row">
						<label className="form-label">DEEPL APIキー:</label>
						<input
							type="text"
							className="form-input"
							value={apiKeys.deepl}
							onChange={(e) => setApiKeys({...apiKeys, deepl: e.target.value})}
							disabled={!isEditing}
						/>
					</div>
					{isEditing && (
						<div className="form-actions">
							<button onClick={handleSave} className="save-button">
								保存
							</button>
							<button onClick={handleCancel} className="cancel-button">
								キャンセル
							</button>
						</div>
					)}
				</div>
			</div>

			{error && <p className="error-message">⚠️ {error}</p>}
		</div>
	);
}
