import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { useAuth } from '../AuthContext'

export default function ReglasTarifa() {
  const { session } = useAuth()

  const [empresaProveedor, setEmpresaProveedor] = useState(null)
  const [proveedorActual, setProveedorActual] = useState(null)
  const [reglas, setReglas] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const [form, setForm] = useState({
  regla: '',
})

  const [tramos, setTramos] = useState([
    {
      tipo: 'volumen',
      cantidad_minima: '',
      cantidad_maxima: '',
      porcentaje_desc: '',
    },
  ])

  const cargarDatos = async () => {
    setLoading(true)
    setMsg('')

    const { data: empresaData, error: empresaError } = await supabase
      .from('empresa')
      .select('id_empresa, nombre')
      .eq('id_empresa', session.id_empresa)
      .single()

    if (empresaError) {
      setMsg(`❌ Error cargando empresa: ${empresaError.message}`)
      setLoading(false)
      return
    }

    setEmpresaProveedor(empresaData)

    const { data: proveedorData, error: proveedorError } = await supabase
      .from('proveedor')
      .select('id_proveedor')
      .eq('id_empresa', session.id_empresa)
      .eq('activo', true)
      .maybeSingle()

    if (proveedorError || !proveedorData) {
      setMsg('❌ Este usuario no pertenece a una empresa proveedora activa.')
      setLoading(false)
      return
    }

    setProveedorActual(proveedorData)

    const { data: reglasData, error: reglasError } = await supabase
      .from('tarifa_regla')
      .select('id_tarifa, nombre, descripcion, activo')
      .eq('id_proveedor', proveedorData.id_proveedor)
      .order('nombre', { ascending: true })

    if (reglasError) {
      setMsg(`❌ Error cargando reglas: ${reglasError.message}`)
      setReglas([])
    } else {
      setReglas(reglasData || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const actualizarTramo = (index, campo, valor) => {
    setTramos((prev) =>
      prev.map((tramo, i) =>
        i === index ? { ...tramo, [campo]: valor } : tramo
      )
    )
  }

  const agregarTramo = () => {
    setTramos((prev) => [
      ...prev,
      {
        tipo: 'volumen',
        cantidad_minima: '',
        cantidad_maxima: '',
        porcentaje_desc: '',
      },
    ])
  }

  const quitarTramo = (index) => {
    if (tramos.length === 1) {
      setMsg('❌ Debe existir al menos un tramo.')
      return
    }

    setTramos((prev) => prev.filter((_, i) => i !== index))
  }

  const crearRegla = async () => {
    setMsg('')

    if (!empresaProveedor?.nombre) {
      setMsg('❌ No se pudo obtener la empresa proveedora.')
      return
    }

    if (!form.regla) {
  setMsg('❌ Selecciona una regla de tarifa.')
  return
}

    if (tramos.length === 0) {
      setMsg('❌ Agrega al menos un tramo.')
      return
    }

    for (const tramo of tramos) {
      if (!tramo.tipo || !tramo.cantidad_minima || !tramo.porcentaje_desc) {
        setMsg('❌ Todos los tramos deben tener tipo, cantidad mínima y porcentaje.')
        return
      }

      if (Number(tramo.cantidad_minima) < 0) {
        setMsg('❌ La cantidad mínima no puede ser negativa.')
        return
      }

      if (
        tramo.cantidad_maxima !== '' &&
        Number(tramo.cantidad_maxima) <= Number(tramo.cantidad_minima)
      ) {
        setMsg('❌ La cantidad máxima debe ser mayor a la mínima.')
        return
      }

      if (Number(tramo.porcentaje_desc) < 0 || Number(tramo.porcentaje_desc) > 100) {
        setMsg('❌ El porcentaje debe estar entre 0 y 100.')
        return
      }
    }

    const tramosJson = tramos.map((t) => ({
      tipo: t.tipo,
      cantidad_minima: Number(t.cantidad_minima),
      cantidad_maxima: t.cantidad_maxima === '' ? '' : Number(t.cantidad_maxima),
      porcentaje_desc: Number(t.porcentaje_desc),
    }))

    const { error } = await supabase.rpc('f_agregar_tramos_a_regla_tarifa', {
  p_nombre_proveedor: empresaProveedor.nombre,
  p_nombre_regla: form.regla,
  p_tramos: tramosJson,
})

    if (error) {
      setMsg(`❌ Error creando regla tarifa: ${error.message}`)
      return
    }

    setMsg('✅ Regla tarifa y tramos creados correctamente.')

    setForm({
  regla: '',
})

    setTramos([
      {
        tipo: 'volumen',
        cantidad_minima: '',
        cantidad_maxima: '',
        porcentaje_desc: '',
      },
    ])

    cargarDatos()
  }

  return (
    <div>
      <PageHeader
        title="Reglas de tarifa"
        subtitle="Crea reglas de tarifa con tramos para usarlas luego en contratos"
        action={
          <button onClick={cargarDatos} style={styles.refreshBtn}>
            ↺ Actualizar
          </button>
        }
      />

      {msg && <div style={styles.msg}>{msg}</div>}

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Agregar tramos a regla tarifa</h3>

        
        <div style={styles.grid}>
  <div style={styles.full}>
    <label style={styles.label}>Regla tarifa</label>

    <select
      style={styles.input}
      value={form.regla}
      onChange={(e) => setForm({ ...form, regla: e.target.value })}
    >
      <option value="">Selecciona una regla</option>

      {reglas.map((regla) => (
        <option key={regla.id_tarifa} value={regla.nombre}>
          {regla.nombre}
        </option>
      ))}
    </select>
  </div>
</div>

        <div style={styles.tramosHeader}>
          <h4 style={styles.sectionTitle}>Tramos</h4>

          <button style={styles.addBtn} onClick={agregarTramo}>
            + Agregar tramo
          </button>
        </div>

        {tramos.map((tramo, index) => (
          <div key={index} style={styles.tramoBox}>
            <div>
              <label style={styles.label}>Tipo</label>
              <select
                style={styles.input}
                value={tramo.tipo}
                onChange={(e) => actualizarTramo(index, 'tipo', e.target.value)}
              >
                <option style={styles.option} value="volumen">Volumen</option>
                <option style={styles.option} value="costo">Costo</option>
              </select>
            </div>

            <div>
              <label style={styles.label}>Cantidad mínima</label>
              <input
                style={styles.input}
                type="number"
                value={tramo.cantidad_minima}
                onChange={(e) => actualizarTramo(index, 'cantidad_minima', e.target.value)}
                placeholder="Ej: 1"
              />
            </div>

            <div>
              <label style={styles.label}>Cantidad máxima</label>
              <input
                style={styles.input}
                type="number"
                value={tramo.cantidad_maxima}
                onChange={(e) => actualizarTramo(index, 'cantidad_maxima', e.target.value)}
                placeholder="Vacío = sin límite"
              />
            </div>

            <div>
              <label style={styles.label}>Descuento %</label>
              <input
                style={styles.input}
                type="number"
                value={tramo.porcentaje_desc}
                onChange={(e) => actualizarTramo(index, 'porcentaje_desc', e.target.value)}
                placeholder="Ej: 10"
              />
            </div>

            <button style={styles.removeBtn} onClick={() => quitarTramo(index)}>
              Quitar
            </button>
          </div>
        ))}

        <div style={styles.actions}>
          <button style={styles.saveBtn} onClick={crearRegla}>
            Crear regla tarifa
          </button>
        </div>
      </div>

      <DataTable
        data={reglas}
        loading={loading}
        emptyMsg="No hay reglas de tarifa registradas para este proveedor."
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
    background: '#648ab0',
    border: '1px solid #556477',
    borderRadius: '8px',
    padding: '10px 14px',
    marginBottom: '1rem',
    color: '#0a1627',
    fontSize: '13px',
  },
  card: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '1rem',
    marginBottom: '1rem',
  },
  cardTitle: {
    margin: '0 0 1rem',
    fontSize: '16px',
    color: '#0f172a',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  full: {
    gridColumn: '1 / -1',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569',
    marginBottom: '6px',
  },
  
input: {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '14px',
  boxSizing: 'border-box',
  background: '#fff',
  color: '#0f172a',
  outline: 'none',
},

  tramosHeader: {
    marginTop: '1.25rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '15px',
    color: '#0f172a',
  },
  addBtn: {
    background: '#fff',
    color: '#1e293b',
    border: '1.5px solid #1e293b',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  tramoBox: {
    marginTop: '0.75rem',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
    gap: '8px',
    alignItems: 'end',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '10px',
  },
  removeBtn: {
    background: '#fee2e2',
    color: '#991b1b',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  actions: {
    marginTop: '1rem',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  saveBtn: {
    padding: '10px 16px',
    background: '#1e293b',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
}