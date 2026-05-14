import { Link } from 'react-router-dom'

const links = [
  { to: '/',           label: '🏠 Dashboard' },
  { to: '/vistas',     label: '📊 Vistas' },
  { to: '/ordenes',    label: '📦 Órdenes (Triggers T2/T3)' },
  { to: '/facturas',   label: '🧾 Facturas (Triggers T4/T5)' },
  { to: '/procedures', label: '⚙️ Procedures' },
  
]

export default function NavBar() {
  return (
    <nav style={{ background: '#1e293b', padding: '0.75rem 1.5rem', display: 'flex', gap: '1.5rem' }}>
      {links.map(l => (
        <Link key={l.to} to={l.to}
          style={{ color: '#94a3b8', textDecoration: 'none', fontWeight: 'bold' }}>
          {l.label}
        </Link>
      ))}
    </nav>
  )
}