import { Link, NavLink } from 'react-router-dom'
import { useRole, type Role } from '../role'

const PAGES = [
  { to: '/challenges', label: 'Challenges', className: 'challenges' },
  { to: '/conversations', label: 'Conversations', className: 'conversations' },
  { to: '/insights', label: 'Insights', className: 'insights' },
]

const ROLES: Role[] = ['learner', 'support']

export function NavBar() {
  const { role, setRole } = useRole()

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span style={{ background: 'var(--pl-blue)' }} />
            <span style={{ background: 'var(--pl-pink)' }} />
            <span style={{ background: 'var(--pl-yellow)' }} />
          </span>
          PennyLane <span className="brand-sub">Support</span>
        </Link>

        <nav className="nav-links" aria-label="Main">
          {PAGES.map((page) => (
            <NavLink key={page.to} to={page.to} className={`nav-link ${page.className}`}>
              {page.label}
            </NavLink>
          ))}
        </nav>

        <div className="role-toggle">
          <span className="role-label">I am:</span>
          <div className="role-toggle-options" role="group" aria-label="Role">
            {ROLES.map((r) => (
              <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)}>
                {r === 'learner' ? 'Learner' : 'Support'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}
