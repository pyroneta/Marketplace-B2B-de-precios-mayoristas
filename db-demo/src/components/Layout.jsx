import { NavLink } from 'react-router-dom'
import { useAuth } from '../AuthContext'

const proveedorLinks = [
  { to: '/dashboard',  icon: '▦',  label: 'Dashboard'        },
  { to: '/mis-ordenes',icon: '📦', label: 'Mis órdenes'      },
  { to: '/stock',      icon: '🏪', label: 'Stock almacenes'  },
  { to: '/comisiones', icon: '💰', label: 'Comisiones'       },
  { to: '/contratos',  icon: '📄', label: 'Contratos'        },
  { to: '/procedures', icon: '⚙️', label: 'Procedures'       },
   { to: '/reglas-tarifa', icon: '⚖️', label: 'Reglas de tarifa' },
   { to: '/productos', icon: '🛍️', label: 'Productos'        },
]

const empresaLinks = [
  { to: '/dashboard',           icon: '▦',  label: 'Dashboard'           },
  { to: '/mis-ordenes',         icon: '📦', label: 'Mis órdenes'         },
  { to: '/productos',           icon: '🛍️', label: 'Productos'           },
  { to: '/facturas',            icon: '🧾', label: 'Facturas pendientes' },
  { to: '/contratos',           icon: '📄', label: 'Contratos'           },
  { to: '/resumen',             icon: '📊', label: 'Resumen de compras'  },
  { to: '/proveedores',         icon: '🏭', label: 'Proveedores'         },
  { to: '/procedures',          icon: '⚙️', label: 'Procedures'          },
]

export default function Layout({ children }) {
  const { session, logout } = useAuth()
  const links = session?.rol === 'proveedor' ? proveedorLinks : empresaLinks

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.brandIcon}>
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="white"/>
              <path d="M7 20L14 8L21 20H7Z" fill="#1e293b"/>
            </svg>
          </div>
          <div>
            <p style={styles.brandName}>Marketplace B2B</p>
            <p style={styles.brandRole}>{session?.rol === 'proveedor' ? 'Proveedor' : 'Empresa compradora'}</p>
          </div>
        </div>

        <div style={styles.userCard}>
          <div style={styles.avatar}>
            {session?.nombre?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={styles.userName}>{session?.nombre ?? 'Usuario'}</p>
            <p style={styles.userEmail}>{session?.email ?? ''}</p>
          </div>
        </div>

        <nav style={styles.nav}>
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              <span style={{ fontSize: '16px' }}>{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <button onClick={logout} style={styles.logout}>
          ← Cerrar sesión
        </button>
      </aside>

      <main style={styles.main}>
        {children}
      </main>
    </div>
  )
}

const styles = {
  shell: { display: 'flex', minHeight: '100vh', background: '#f1f5f9' },
  sidebar: { width: '240px', flexShrink: 0, background: '#1e293b', display: 'flex', flexDirection: 'column', padding: '1.25rem' },
  brand: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' },
  brandIcon: { width: '36px', height: '36px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  brandName: { margin: 0, fontSize: '13px', fontWeight: '700', color: '#f8fafc', lineHeight: 1.2 },
  brandRole: { margin: 0, fontSize: '11px', color: '#94a3b8' },
  userCard: { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.07)', borderRadius: '10px', padding: '10px', marginBottom: '1.5rem', overflow: 'hidden' },
  avatar: { width: '34px', height: '34px', borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px', flexShrink: 0 },
  userName:  { margin: 0, fontSize: '13px', fontWeight: '600', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userEmail: { margin: 0, fontSize: '11px', color: '#64748b',  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  nav: { display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 },
  navLink: { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', fontSize: '13.5px', fontWeight: '500', color: '#94a3b8', textDecoration: 'none', transition: 'all 0.15s' },
  navLinkActive: { background: 'rgba(255,255,255,0.1)', color: '#f8fafc' },
  logout: { marginTop: '1rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', borderRadius: '8px', padding: '8px', fontSize: '12px', cursor: 'pointer', textAlign: 'left' },
  main: { flex: 1, padding: '2rem', overflowY: 'auto' },
}
