import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Channels from './pages/channels';
import Episodes from './pages/episodes';
import Episode from './pages/episode';

function AppRoute() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/channels" element={<Channels />} />
        <Route path="/episodes" element={<Episodes />} />
        <Route path="/episode" element={<Episode />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoute;