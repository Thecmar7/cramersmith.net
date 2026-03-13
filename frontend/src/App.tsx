import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Nav from './components/Nav'
import Portfolio from './pages/Portfolio'
import Feed from './pages/Feed'
import Admin from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/"      element={<Portfolio />} />
        <Route path="/feed"  element={<Feed />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  )
}
