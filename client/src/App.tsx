import { Navigate, Route, Routes } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { ChallengeDetailPage } from './pages/ChallengeDetailPage'
import { ChallengesPage } from './pages/ChallengesPage'
import { ConversationsPage } from './pages/ConversationsPage'
import { InsightsPage } from './pages/InsightsPage'

function App() {
  return (
    <>
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/challenges" replace />} />
          <Route path="/challenges" element={<ChallengesPage />} />
          <Route path="/challenges/:id" element={<ChallengeDetailPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="*" element={<p className="muted">Page not found.</p>} />
        </Routes>
      </main>
    </>
  )
}

export default App
