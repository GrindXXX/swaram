import { BrowserRouter, Navigate, Routes, Route, useParams } from 'react-router-dom';
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
import { MyIssues } from './pages/MyIssues';
import { SignIn } from './pages/SignIn';
import { SignUp } from './pages/SignUp';

function LegacyThreadRoute({ verify = false }: { verify?: boolean }) {
  const { id } = useParams();
  return <Navigate to={`/i/${id ?? ''}${verify ? '/verify' : ''}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Feed />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/i/:id" element={<Thread />} />
        <Route path="/i/:id/verify" element={<RepairVerification />} />
        <Route path="/thread/:id" element={<LegacyThreadRoute />} />
        <Route path="/thread/:id/verify" element={<LegacyThreadRoute verify />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/report" element={<ReportStep1 />} />
        <Route path="/report/confirm" element={<ReportStep2 />} />
        <Route path="/weekly" element={<WeeklyRecord />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/me/issues" element={<MyIssues />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/profile/leagues" element={<Leagues />} />
        <Route path="/ticket/:id/burned" element={<BurnedTicket />} />
      </Routes>
    </BrowserRouter>
  );
}
