import { NavLink } from 'react-router-dom'
import './Nav.css'

export default function Nav() {
  return (
    <nav className="nav">
      <span className="nav-name">Cramer Smith</span>
      <div className="nav-links">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Portfolio
        </NavLink>
        <NavLink to="/feed" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Feed
        </NavLink>
      </div>
    </nav>
  )
}
