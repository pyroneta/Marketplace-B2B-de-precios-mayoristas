import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'

const VISTAS_CONFIG = {
  stock: {
    title: 'Stock de almacenes',
    subtitle: 'Estado actual del inventario por almacén y producto',
    view: 'v_stock_almacenes',
  },
  comisiones: {
    title: 'Comisiones generadas',
    subtitle: 'Resumen de comisiones por proveedor',
    view: 'v_comisiones_proveedor',
  },
  contratos: {
    title: 'Contratos activos',
    subtitle: 'Contratos vigentes entre proveedores y empresas',
    view: 'v_contratos_activos',
  },
  facturas: {
    title: 'Facturas pendientes',
    subtitle: 'Facturas que aún no han sido pagadas',
    view: 'v_facturas_pendientes',
  },
  productos: {
    title: 'Productos más comprados',
    subtitle: 'Ranking de productos por volumen de compra',
    view: 'v_productos_mas_comprados',
  },
  resumen: {
    title: 'Resumen de órdenes',
    subtitle: 'Estadísticas de compra por empresa compradora',
    view: 'v_resumen_ordenes_empresa',
  },
  comisiones_detalle: {
    title: 'Detalle de comisiones',
    subtitle: 'Comisiones desglosadas por orden y producto',
    view: 'v_comisiones_detalle',
  },
  proveedores: {
    title: 'Proveedores más comprados',
    subtitle: 'Ranking de proveedores por volumen de ventas',
    view: 'v_proveedores_mas_comprados',
  },
}

export default function VistaPage({ tipo }) {
  const config = VISTAS_CONFIG[tipo]
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    const { data: rows } = await supabase.from(config.view).select('*').limit(100)
    setData(rows || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [tipo])

  if (!config) return <p style={{ color: '#dc2626' }}>Vista no encontrada: {tipo}</p>

  return (
    <div>
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        action={
          <button onClick={fetchData} style={styles.refreshBtn}>
            ↺ Actualizar
          </button>
        }
      />
      <DataTable data={data} loading={loading} emptyMsg={`No hay registros en ${config.view}.`} />
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
}
