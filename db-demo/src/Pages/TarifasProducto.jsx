import { useState } from 'react'
import { supabase } from '../supabaseClient'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'

export default function TarifasProducto() {
  const [busqueda, setBusqueda] = useState('')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const buscar = async () => {
    setLoading(true)
    setMsg('')

    let query = supabase
      .from('v_tarifas_publicas_producto')
      .select('*')
      .limit(100)

    if (busqueda.trim()) {
      query = query.or(`sku.ilike.%${busqueda.trim()}%,producto.ilike.%${busqueda.trim()}%`)
    }

    const { data: rows, error } = await query

    if (error) {
      setMsg(`❌ Error buscando tarifas: ${error.message}`)
      setData([])
    } else {
      setData(rows || [])
    }

    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="Tarifas por producto"
        subtitle="Consulta precios públicos, proveedores y stock disponible"
        action={null}
      />

      <div style={styles.searchRow}>
        <input
          style={styles.input}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por SKU o producto"
        />

        <button style={styles.searchBtn} onClick={buscar}>
          Buscar
        </button>
      </div>

      {msg && <div style={styles.msg}>{msg}</div>}

      <DataTable
        data={data}
        loading={loading}
        emptyMsg="Busca un SKU o producto para ver tarifas."
      />
    </div>
  )
}

const styles = {
  searchRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 120px',
    gap: '8px',
    marginBottom: '1rem',
  },
  input: {
    padding: '10px 12px',
    border: '1.5px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
  },
  searchBtn: {
    background: '#1e293b',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  msg: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '10px 14px',
    marginBottom: '1rem',
    color: '#334155',
    fontSize: '13px',
  },
}