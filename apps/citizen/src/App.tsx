import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Feed } from './pages/Feed';
import { Alerts } from './pages/Alerts';
import { Thread } from './pages/Thread';
import { RepairVerification } from './pages/RepairVerification';
import { MapView } from './pages/MapView';
import { ReportStep1 } from './pages/ReportStep1';
import { ReportStep2 } from './pages/ReportStep2';
import { WeeklyRecord } from './pages/WeeklyRecord';
import { Profile } from './pages/Profile';
import { Leagues } from './pages/Leagues';
import { BurnedTicket } from './pages/BurnedTicket';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Feed />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/thread/:id" element={<Thread />} />
        <Route path="/thread/:id/verify" element={<RepairVerification />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/report" element={<ReportStep1 />} />
        <Route path="/report/confirm" element={<ReportStep2 />} />
        <Route path="/weekly" element={<WeeklyRecord />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/leagues" element={<Leagues />} />
        <Route path="/ticket/:id/burned" element={<BurnedTicket />} />
      </Routes>
    </BrowserRouter>
  );
}
