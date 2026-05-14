import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { useAuth } from '../AuthContext'

export default function Productos() {
  const { session } = useAuth()

  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const [form, setForm] = useState({
    sku: '',
    nombre: '',
    descripcion: '',
    unidad_medida: '',
    nombre_categoria: '',
  })

  const cargarDatos = async () => {
    setLoading(true)
    setMsg('')

    const { data: categoriasData, error: categoriasError } = await supabase
      .from('categoria')
      .select('id_categoria, nombre, descripcion')
      .order('nombre', { ascending: true })

    if (categoriasError) {
      setMsg(`❌ Error cargando categorías: ${categoriasError.message}`)
      setCategorias([])
    } else {
      setCategorias(categoriasData || [])
    }

    const { data: productosData, error: productosError } = await supabase
      .from('producto')
      .select(`
        sku,
        nombre,
        descripcion,
        unidad_medida,
        activo,
        categoria:id_categoria (
          nombre
        )
      `)
      .order('nombre', { ascending: true })


    const { data: productosAlmacenData, error: productosAlmacenError } = await supabase
        .from('v_productos_almacen')
        

    if (productosError) {
      setMsg(`❌ Error cargando productos: ${productosError.message}`)
      setProductos([])
    } else {
      const productosFormateados = (productosData || []).map((producto) => ({
        sku: producto.sku,
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        unidad_medida: producto.unidad_medida,
        categoria: producto.categoria?.nombre || 'Sin categoría',
        activo: producto.activo ? 'Activo' : 'Inactivo',
      }))

      setProductos(productosFormateados)
    }

    setLoading(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const limpiarForm = () => {
    setForm({
      sku: '',
      nombre: '',
      descripcion: '',
      unidad_medida: '',
      nombre_categoria: '',
    })
  }

  const crearProducto = async () => {
    setMsg('')

    if (!form.sku || !form.nombre || !form.unidad_medida || !form.nombre_categoria) {
      setMsg('❌ Completa SKU, nombre, unidad de medida y categoría.')
      return
    }

    setSaving(true)

    const { error } = await supabase.rpc('fn_agregar_productos', {
      p_nombre: form.nombre,
      p_descripcion: form.descripcion,
      p_unidad_medida: form.unidad_medida,
      p_nombre_categoria: form.nombre_categoria,
      p_sku: form.sku,
    })

    if (error) {
      setMsg(`❌ Error agregando producto: ${error.message}`)
      setSaving(false)
      return
    }

    setMsg('✅ Producto agregado correctamente.')
    limpiarForm()
    await cargarDatos()

    setSaving(false)
  }

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle="Registra y consulta los productos disponibles en el marketplace"
        action={
          <button onClick={cargarDatos} style={styles.refreshBtn}>
            ↺ Actualizar
          </button>
        }
      />

      {msg && <div style={styles.msg}>{msg}</div>}

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Agregar producto</h3>

        <div style={styles.grid}>
          <div>
            <label style={styles.label}>SKU</label>
            <input
              style={styles.input}
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="Ej: PROD-001"
            />
          </div>

          <div>
            <label style={styles.label}>Nombre</label>
            <input
              style={styles.input}
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Arroz 1kg"
            />
          </div>

          <div>
            <label style={styles.label}>Unidad de medida</label>
            <input
              style={styles.input}
              value={form.unidad_medida}
              onChange={(e) => setForm({ ...form, unidad_medida: e.target.value })}
              placeholder="Ej: unidad, kg, caja"
            />
          </div>

          <div>
            <label style={styles.label}>Categoría</label>
            <select
              style={styles.input}
              value={form.nombre_categoria}
              onChange={(e) => setForm({ ...form, nombre_categoria: e.target.value })}
            >
              <option value="">Selecciona una categoría</option>

              {categorias.map((categoria) => (
                <option key={categoria.id_categoria} value={categoria.nombre}>
                  {categoria.nombre}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.full}>
            <label style={styles.label}>Descripción</label>
            <textarea
              style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Descripción del producto"
            />
          </div>
        </div>

        <div style={styles.actions}>
          <button style={styles.clearBtn} onClick={limpiarForm} disabled={saving}>
            Limpiar
          </button>

          <button style={styles.saveBtn} onClick={crearProducto} disabled={saving}>
            {saving ? 'Guardando...' : 'Agregar producto'}
          </button>
        </div>
      </div>

      <DataTable
        data={productos}
        loading={loading}
        emptyMsg="No hay productos registrados."
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
  actions: {
    marginTop: '1rem',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  clearBtn: {
    padding: '10px 16px',
    background: '#fff',
    color: '#475569',
    border: '1.5px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
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