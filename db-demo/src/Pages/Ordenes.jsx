import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Ordenes() {
  const [ordenes, setOrdenes] = useState([])
  const [msg, setMsg] = useState('')

  const fetchOrdenes = async () => {
    const { data } = await supabase
      .from('orden_compra')
      .select('id_orden, id_estado, total, fecha')
      .order('fecha', { ascending: false })
      .limit(30)
    setOrdenes(data || [])
  }

  useEffect(() => { fetchOrdenes() }, [])

  const cambiarEstado = async (id, nuevoEstado) => {
    setMsg('')
    const { error } = await supabase
      .from('orden_compra')
      .update({ id_estado: nuevoEstado })
      .eq('id_orden', id)

    if (error) setMsg(`❌ Error: ${error.message}`)
    else {
      setMsg(`✅ Orden actualizada a "${nuevoEstado}". Trigger ejecutado.`)
      fetchOrdenes()
    }
  }

  return (
    <div>
      <h2>Órdenes — Triggers T2 y T3</h2>
      <p style={{ color: '#555' }}>
        <b>T2:</b> Cancelar una orden revierte el stock.<br />
        <b>T3:</b> Aprobar una orden genera una factura automáticamente.
      </p>
      {msg && <p style={{ background: '#f0fdf4', padding: '0.5rem 1rem', borderRadius: '8px' }}>{msg}</p>}
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ background: '#0f172a', color: '#e2e8f0' }}>
            <th style={{ padding: '8px' }}>ID Orden</th>
            <th style={{ padding: '8px' }}>Total</th>
            <th style={{ padding: '8px' }}>Estado</th>
            <th style={{ padding: '8px' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {ordenes.map((o, i) => (
            <tr key={o.id_orden} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff' }}>
              <td style={{ padding: '6px 8px', fontSize: '0.75rem', color: '#888' }}>{o.id_orden}</td>
              <td style={{ padding: '6px 8px' }}>{o.total}</td>
              <td style={{ padding: '6px 8px' }}>
                <span style={{
                  background: { pendiente: '#fef9c3', aprobado: '#dcfce7', cancelado: '#fee2e2', rechazado: '#e2e8f0' }[o.id_estado],
                  padding: '2px 8px', borderRadius: '999px', fontSize: '0.8rem'
                }}>{o.id_estado}</span>
              </td>
              <td style={{ padding: '6px 8px', display: 'flex', gap: '0.4rem' }}>
                <button onClick={() => cambiarEstado(o.id_orden, 'aprobado')}
                  style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}>
                  Aprobar
                </button>
                <button onClick={() => cambiarEstado(o.id_orden, 'cancelado')}
                  style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={() => cambiarEstado(o.id_orden, 'rechazado')}
                  style={{ background: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}>
                  Rechazar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}