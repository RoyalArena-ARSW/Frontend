import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProfileProvider } from './context/ProfileContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { MatchProvider } from './context/MatchContext';
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Register/RegisterPage';
import MenuPage from './pages/Menu/MenuPage';
import DeckPage from './pages/Deck/DeckPage';
import CollectionPage from './pages/Collection/CollectionPage';
import ProfilePage from './pages/Profile/ProfilePage';
import LeaderboardPage from './pages/Leaderboard/LeaderboardPage';
import MatchmakingPage from './pages/Matchmaking/MatchmakingPage';
import BattlePage from './pages/Battle/BattlePage';

export default function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <WebSocketProvider>
          <MatchProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route
                  path="/menu"
                  element={
                    <ProtectedRoute>
                      <MenuPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/deck"
                  element={
                    <ProtectedRoute>
                      <DeckPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/collection"
                  element={
                    <ProtectedRoute>
                      <CollectionPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/leaderboard"
                  element={
                    <ProtectedRoute>
                      <LeaderboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/matchmaking"
                  element={
                    <ProtectedRoute>
                      <MatchmakingPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/battle/:matchId"
                  element={
                    <ProtectedRoute>
                      <BattlePage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/" element={<Navigate to="/menu" replace />} />
                <Route path="*" element={<Navigate to="/menu" replace />} />
              </Routes>
            </BrowserRouter>
          </MatchProvider>
        </WebSocketProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
