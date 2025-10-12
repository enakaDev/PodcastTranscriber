import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Channels from './pages/channels';
import Episodes from './pages/episodes';

function AppRoute() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/channels" element={<Channels />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoute;