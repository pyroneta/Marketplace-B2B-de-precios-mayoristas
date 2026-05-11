import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'

export default function Dashboard() {
  const { session } = useAuth()
  const isProveedor = session?.rol === 'proveedor'

  const [counts, setCounts] = useState({})
  const [tableData, setTableData] = useState([])
  const [tableLoading, setTableLoading] = useState(true)
  const [activeView, setActiveView] = useState(null)


  
  const cards = isProveedor
    ? [
        { key: 'v_ordenes_activas',      label: 'Órdenes activas',     color: '#3b82f6', icon: '📦' },
        { key: 'v_comisiones_proveedor', label: 'Comisiones totales',  color: '#8b5cf6', icon: '💰' },
        { key: 'v_contratos_activos',    label: 'Contratos activos',   color: '#10b981', icon: '📄' },
        { key: 'v_productos_sin_stock',  label: 'Productos sin stock', color: '#ef4444', icon: '⚠️' },
      ]
    : [
        { key: 'v_ordenes_activas',         label: 'Órdenes activas',    color: '#3b82f6', icon: '📦' },
        { key: 'v_facturas_pendientes',     label: 'Facturas pendientes',color: '#f59e0b', icon: '🧾' },
        { key: 'v_contratos_activos',       label: 'Contratos activos',  color: '#10b981', icon: '📄' },
        { key: 'v_productos_mas_comprados', label: 'Productos comprados',color: '#6366f1', icon: '🛍️' },
      ]

  useEffect(() => {
    async function loadCounts() {
      const results = await Promise.all(
        cards.map(c => supabase.from(c.key).select('*', { count: 'exact', head: true }))
      )
      const obj = {}
      cards.forEach((c, i) => { obj[c.key] = results[i].count ?? 0 })
      setCounts(obj)
    }
    loadCounts()
  }, [])

  const loadView = async (viewKey) => {
    setActiveView(viewKey)
    setTableLoading(true)
    const { data } = await supabase.from(viewKey).select('*').limit(50)
    setTableData(data || [])
    setTableLoading(false)
  }

  return (
    <div>
      <PageHeader
        title={`Bienvenido, ${session?.nombre?.split(' ')[0] ?? 'usuario'}`}
        subtitle={`Panel de ${isProveedor ? 'proveedor' : 'empresa compradora'} · ${new Date().toLocaleDateString('es-BO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
      />

      <div style={styles.cardGrid}>
        {cards.map(c => (
          <button key={c.key} style={{ ...styles.card, borderTop: `3px solid ${c.color}` }} onClick={() => loadView(c.key)}>
            <span style={{ fontSize: '24px' }}>{c.icon}</span>
            <div style={{ ...styles.count, color: c.color }}>{counts[c.key] ?? '—'}</div>
            <div style={styles.cardLabel}>{c.label}</div>
            <div style={styles.cardHint}>Ver detalle →</div>
          </button>
        ))}
      </div>

      {activeView && (
        <div style={styles.tableSection}>
          <div style={styles.tableHeader}>
            <p style={styles.tableTitle}>
              {cards.find(c => c.key === activeView)?.label}
            </p>
            <button style={styles.closeBtn} onClick={() => setActiveView(null)}>✕ Cerrar</button>
          </div>
          <DataTable data={tableData} loading={tableLoading} />
        </div>
      )}

      {!activeView && (
        <div style={styles.hint}>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
            💡 Hacé click en una card para ver el detalle de esa vista
          </p>
        </div>
      )}
    </div>
  )
}

const styles = {
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  card: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '1.25rem',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    transition: 'box-shadow 0.15s',
  },
  count: {
    fontSize: '32px',
    fontWeight: '700',
    lineHeight: 1,
  },
  cardLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#334155',
  },
  cardHint: {
    fontSize: '11px',
    color: '#94a3b8',
    marginTop: '2px',
  },
  tableSection: {
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid #f1f5f9',
  },
  tableTitle: {
    margin: 0,
    fontWeight: '700',
    fontSize: '15px',
    color: '#0f172a',
  },
  closeBtn: {
    background: '#f1f5f9',
    border: 'none',
    borderRadius: '6px',
    padding: '5px 12px',
    fontSize: '12px',
    color: '#64748b',
    cursor: 'pointer',
  },
  hint: {
    background: '#f8fafc',
    border: '1px dashed #e2e8f0',
    borderRadius: '12px',
    padding: '1.5rem',
    textAlign: 'center',
  },
}
