import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/marg/ProtectedRoute'
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'
import Home from '@/pages/Home'
import Results from '@/pages/Results'
import MapDetail from '@/pages/MapDetail'
import Trips from '@/pages/Trips'
import Profile from '@/pages/Profile'
import Safety from '@/pages/Safety'
import TrackView from '@/pages/TrackView'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/results" element={<ProtectedRoute><Results /></ProtectedRoute>} />
      <Route path="/map" element={<ProtectedRoute><MapDetail /></ProtectedRoute>} />
      <Route path="/trips" element={<ProtectedRoute><Trips /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/safety" element={<ProtectedRoute><Safety /></ProtectedRoute>} />
      {/* Public — a trusted contact opens this from a share link, no login */}
      <Route path="/track/:id" element={<TrackView />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
