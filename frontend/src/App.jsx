import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Loading from './components/Loading.jsx'
import { RequireAuth, RequireCreator } from './auth/guards.jsx'

// Route-level code splitting: each page (and its deps, e.g. @react-oauth/google
// on Login) is a separate chunk fetched on demand.
const Login = lazy(() => import('./pages/Login.jsx'))
const Catalog = lazy(() => import('./pages/Catalog.jsx'))
const SessionDetail = lazy(() => import('./pages/SessionDetail.jsx'))
const MyBookings = lazy(() => import('./pages/MyBookings.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))
const CreatorDashboard = lazy(() => import('./pages/CreatorDashboard.jsx'))
const SessionForm = lazy(() => import('./pages/SessionForm.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))

const fallback = (
  <div style={{ padding: 40 }}>
    <Loading />
  </div>
)

export default function App() {
  return (
    <Suspense fallback={fallback}>
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
    </Suspense>
  )
}
