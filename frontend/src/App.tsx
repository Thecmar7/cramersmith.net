import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { VibeProvider } from './context/VibeContext'
import Nav from './components/Nav'
import Portfolio from './pages/Portfolio'
import Feed from './pages/Feed'
import Post from './pages/Post'
import Contact from './pages/Contact'
import Admin from './pages/Admin'
import DnDScreen from './pages/DnDScreen'
import DeployBadge from './components/DeployBadge'

export default function App() {
  return (
    <VibeProvider>
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/"           element={<Portfolio />} />
        <Route path="/feed"       element={<Feed />} />
        <Route path="/blog/:slug" element={<Post />} />
        <Route path="/contact"    element={<Contact />} />
        <Route path="/dnd"        element={<DnDScreen />} />
        <Route path="/admin"      element={<Admin />} />
      </Routes>
      <DeployBadge />
    </BrowserRouter>
    </VibeProvider>
  )
}
