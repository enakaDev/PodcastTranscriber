import { BrowserRouter, Routes, Route } from "react-router-dom";
import ChannelList from "./pages/channelList";
import Episodes from "./pages/channel";
import Episode from "./pages/episode";
import Auth from "./pages/login";
import MyPage from "./pages/myPage";

function AppRoute() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/login" element={<Auth />} />
				<Route path="/" element={<ChannelList />} />
				<Route path="/channel" element={<Episodes />} />
				<Route path="/episode" element={<Episode />} />
				<Route path="/myPage" element={<MyPage />} />
			</Routes>
		</BrowserRouter>
	);
}

export default AppRoute;
