import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { useAuth } from '../AuthContext'

export default function Facturas() {
  const { session } = useAuth()

  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [idProveedor, setIdProveedor] = useState(null)

  const cargarProveedorActual = async () => {
    if (session?.rol !== 'proveedor') return null

    const { data, error } = await supabase
      .from('proveedor')
      .select('id_proveedor')
      .eq('id_empresa', session.id_empresa)
      .maybeSingle()

    if (error) {
      setMsg(`❌ Error cargando proveedor: ${error.message}`)
      return null
    }

    setIdProveedor(data?.id_proveedor || null)
    return data?.id_proveedor || null
  }

  const fetchFacturas = async () => {
    setLoading(true)
    setMsg('')

    let proveedorActual = idProveedor

    if (session?.rol === 'proveedor' && !proveedorActual) {
      proveedorActual = await cargarProveedorActual()
    }

    let query = supabase
      .from('v_facturas_panel')
      .select('*')
      .order('fecha_factura', { ascending: false })
      .limit(100)

    if (session?.rol === 'proveedor') {
      query = query.eq('id_proveedor', proveedorActual)
    } else {
      query = query.eq('id_empresa_compradora', session.id_empresa)
    }

    const { data, error } = await query

    if (error) {
      setMsg(`❌ Error cargando facturas: ${error.message}`)
      setFacturas([])
    } else {
      setFacturas(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchFacturas()
  }, [session])

  const confirmarPago = async (idFactura) => {
    setMsg('')

    const { error } = await supabase
      .from('factura')
      .update({ id_estado: 'pagada' })
      .eq('id_factura', idFactura)
      .eq('id_estado', 'pendiente')

    if (error) {
      setMsg(`❌ Error confirmando pago: ${error.message}`)
      return
    }

    setMsg('✅ Pago confirmado. La factura quedó como pagada.')
    fetchFacturas()
  }

  const anularFactura = async (idFactura) => {
    setMsg('')

    const { error } = await supabase
      .from('factura')
      .update({ id_estado: 'anulada' })
      .eq('id_factura', idFactura)
      .eq('id_estado', 'pendiente')

    if (error) {
      setMsg(`❌ Error anulando factura: ${error.message}`)
      return
    }

    setMsg('✅ Factura anulada.')
    fetchFacturas()
  }

  const dataConAcciones = facturas.map((f) => ({
    ...f,
    acciones:
      session?.rol === 'proveedor' && f.estado_factura === 'pendiente'
        ? (
          <button style={styles.payBtn} onClick={() => confirmarPago(f.id_factura)}>
            Confirmar pago
          </button>
        )
        : f.estado_factura === 'pendiente'
          ? (
            <span style={styles.pendingText}>Pendiente de confirmación</span>
          )
          : (
            <span style={styles.noActions}>Sin acciones</span>
          )
  }))

  return (
    <div>
      <PageHeader
        title="Facturas"
        subtitle={
          session?.rol === 'proveedor'
            ? 'Confirma pagos de facturas pendientes'
            : 'Consulta tus facturas pendientes, pagadas o anuladas'
        }
        action={
          <button onClick={fetchFacturas} style={styles.refreshBtn}>
            ↺ Actualizar
          </button>
        }
      />

      {msg && <div style={styles.msg}>{msg}</div>}

      <DataTable
        data={dataConAcciones}
        loading={loading}
        emptyMsg="No hay facturas para mostrar."
      />
    </div>
  )
}

const styles = {
  refreshBtn: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    cursor: 'pointer',
    color: '#475569',
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
  payBtn: {
    background: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  pendingText: {
    color: '#854d0e',
    fontSize: '12px',
    fontWeight: '600',
  },
  noActions: {
    color: '#94a3b8',
    fontSize: '12px',
    fontWeight: '600',
  },
}