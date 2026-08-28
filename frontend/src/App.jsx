import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import { RequireAuth, RequireCreator } from './auth/guards.jsx'

import Login from './pages/Login.jsx'
import Catalog from './pages/Catalog.jsx'
import SessionDetail from './pages/SessionDetail.jsx'
import MyBookings from './pages/MyBookings.jsx'
import Profile from './pages/Profile.jsx'
import CreatorDashboard from './pages/CreatorDashboard.jsx'
import SessionForm from './pages/SessionForm.jsx'
import NotFound from './pages/NotFound.jsx'

// /login renders full-bleed (its own split-screen layout); everything else is
// wrapped in the app chrome (top bar + footer).
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Catalog />} />
              <Route path="/sessions/:id" element={<SessionDetail />} />

              <Route
                path="/bookings"
                element={
                  <RequireAuth>
                    <MyBookings />
                  </RequireAuth>
                }
              />
              <Route
                path="/profile"
                element={
                  <RequireAuth>
                    <Profile />
                  </RequireAuth>
                }
              />

              <Route
                path="/dashboard"
                element={
                  <RequireCreator>
                    <CreatorDashboard />
                  </RequireCreator>
                }
              />
              <Route
                path="/sessions/new"
                element={
                  <RequireCreator>
                    <SessionForm mode="create" />
                  </RequireCreator>
                }
              />
              <Route
                path="/sessions/:id/edit"
                element={
                  <RequireCreator>
                    <SessionForm mode="edit" />
                  </RequireCreator>
                }
              />

              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  )
}
