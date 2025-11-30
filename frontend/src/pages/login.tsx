import "../App.css";

export default function Auth() {
	const backendUrl = import.meta.env.VITE_BACKEND_URL;
	const handleLogin = async () => {
		window.location.href = `${backendUrl}auth/login`;
	};

	return (
		<div className="app-container">
			<button onClick={handleLogin}>Googleアカウントでログイン</button>
		</div>
	);
}
