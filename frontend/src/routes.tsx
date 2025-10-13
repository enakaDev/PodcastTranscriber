import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ChannelList from './pages/channelList';
import Episodes from './pages/channel';
import Episode from './pages/episode';

function AppRoute() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChannelList />} />
        <Route path="/Channel" element={<Episodes />} />
        <Route path="/episode" element={<Episode />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoute;