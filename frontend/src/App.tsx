import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { VibeProvider } from './context/VibeContext'
import Nav from './components/Nav'
import Portfolio from './pages/Portfolio'
import Feed from './pages/Feed'
import Admin from './pages/Admin'
import DeployBadge from './components/DeployBadge'

export default function App() {
  return (
    <VibeProvider>
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/"      element={<Portfolio />} />
        <Route path="/feed"  element={<Feed />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
      <DeployBadge />
    </BrowserRouter>
    </VibeProvider>
  )
}
