import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import DataTable from '../components/DataTable'

const VISTAS = [
  { key: 'v_tramos_reglas',           label: 'Tramos por Regla' },
  { key: 'v_contratos_por_vencer',    label: 'Contratos por Vencer (30 días)' },
  { key: 'v_contratos_activos',       label: 'Contratos Activos' },
  { key: 'v_productos_sin_stock',     label: 'Productos sin Stock' },
  { key: 'v_ordenes_activas',         label: 'Órdenes Activas' },
  { key: 'v_ordenes_por_vencer',      label: 'Órdenes por Vencer Hoy' },
  { key: 'v_detalle_orden',           label: 'Detalle Orden' },
  { key: 'v_stock_almacenes',         label: 'Stock en Almacenes' },
  { key: 'v_comisiones_proveedor',    label: 'Comisiones por Proveedor' },
  { key: 'v_comisiones_detalle',      label: 'Detalle Comisiones' },
  { key: 'v_resumen_ordenes_empresa', label: 'Resumen Órdenes por Empresa' },
  { key: 'v_facturas_pendientes',     label: 'Facturas Pendientes' },
  { key: 'v_productos_mas_comprados', label: 'Productos más Comprados' },
  { key: 'v_proveedores_mas_comprados', label: 'Proveedores más Vendidos' },
]

export default function Vistas() {
  const [selected, setSelected] = useState(VISTAS[0].key)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    supabase.from(selected).select('*').limit(100).then(({ data }) => {
      setData(data || [])
      setLoading(false)
    })
  }, [selected])

  return (
    <div>
      <h2>Vistas de la BD</h2>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {VISTAS.map(v => (
          <button key={v.key} onClick={() => setSelected(v.key)}
            style={{
              padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
              background: selected === v.key ? '#1e293b' : '#e2e8f0',
              color: selected === v.key ? '#fff' : '#1e293b',
              border: 'none', fontWeight: selected === v.key ? 'bold' : 'normal'
            }}>
            {v.label}
          </button>
        ))}
      </div>
      <DataTable data={data} loading={loading} />
    </div>
  )
}