import { BrowserRouter, Routes, Route } from "react-router-dom";
import ChannelList from "./pages/channelList";
import Episodes from "./pages/channel";
import Episode from "./pages/episode";
import Auth from "./pages/login";

function AppRoute() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<Auth />} />
				<Route path="/ChannelList" element={<ChannelList />} />
				<Route path="/Channel" element={<Episodes />} />
				<Route path="/episode" element={<Episode />} />
			</Routes>
		</BrowserRouter>
	);
}

export default AppRoute;
