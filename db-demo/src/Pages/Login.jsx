import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: usuario, error: errUsuario } = await supabase
  .from('usuario')
  .select('id_usuario, nombre, email, id_empresa, id_sucursal, id_rol, activo')
  .eq('email', email.trim())
  .single()

    if (errUsuario || !usuario) {
      setError('Usuario no encontrado.')
      setLoading(false)
      return
    }

    if (usuario.activo === false) {
      setError('Usuario inactivo.')
      setLoading(false)
      return
    }

    
    const { data: esProveedor } = await supabase
  .from('proveedor')
  .select('id_proveedor')
  .eq('id_empresa', usuario.id_empresa)
  .maybeSingle()

    const rol = esProveedor ? 'proveedor' : 'empresa'

    setLoading(false)
    login({ ...usuario, rol })
  }

  return (
    <div style={styles.bg}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <div style={styles.logoCircle}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="#1e293b" />
              <path d="M7 20L14 8L21 20H7Z" fill="white" opacity="0.9" />
            </svg>
          </div>

          <div>
            <p style={styles.logoTitle}>Marketplace B2B</p>
            <p style={styles.logoSub}>Panel de gestión</p>
          </div>
        </div>

        <p style={styles.heading}>Iniciá sesión</p>

        <form onSubmit={handleLogin}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              placeholder="usuario@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Contraseña</label>
            <input
              style={styles.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button style={styles.submit} type="submit" disabled={loading}>
            {loading ? 'Verificando...' : 'Ingresar →'}
          </button>
        </form>

        <div style={styles.registerBox}>
          <p style={styles.registerText}>¿Tu empresa todavía no tiene cuenta?</p>

          <button
            style={styles.registerBtn}
            type="button"
            onClick={() => navigate('/registro')}
          >
            Registrar empresa →
          </button>
        </div>

        <p style={styles.hint}>
          Demo: ingresá con el email de cualquier usuario de la BD.<br />
          El rol proveedor / empresa compradora se detecta automáticamente.<br />
          La contraseña no se valida en esta versión demo.
        </p>
      </div>
    </div>
  )
}

const styles = {
  bg: {
    minHeight: '100vh',
    background: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '2rem',
  },
  logoCircle: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    overflow: 'hidden',
    flexShrink: 0,
  },
  logoTitle: {
    margin: 0,
    fontWeight: '700',
    fontSize: '15px',
    color: '#0f172a',
  },
  logoSub: {
    margin: 0,
    fontSize: '12px',
    color: '#94a3b8',
  },
  heading: {
    fontSize: '22px',
    fontWeight: '600',
    color: '#0f172a',
    margin: '0 0 1.5rem',
  },
  field: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: '#475569',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1.5px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#0f172a',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#fff',
  },
  error: {
    color: '#dc2626',
    fontSize: '13px',
    marginBottom: '0.75rem',
    background: '#fef2f2',
    padding: '8px 12px',
    borderRadius: '6px',
  },
  submit: {
    width: '100%',
    padding: '11px',
    background: '#1e293b',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  registerBox: {
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid #e2e8f0',
    textAlign: 'center',
  },
  registerText: {
    margin: '0 0 0.75rem',
    fontSize: '13px',
    color: '#64748b',
  },
  registerBtn: {
    width: '100%',
    padding: '10px',
    background: '#fff',
    color: '#1e293b',
    border: '1.5px solid #1e293b',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  hint: {
    marginTop: '1.25rem',
    fontSize: '12px',
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: '1.6',
  },
}