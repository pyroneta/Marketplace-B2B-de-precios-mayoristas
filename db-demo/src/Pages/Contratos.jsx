import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { useAuth } from '../AuthContext'

export default function Contratos() {
  const { session } = useAuth()

  const [contratos, setContratos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [reglas, setReglas] = useState([])
  const [productos, setProductos] = useState([])

  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)

  const [empresaProveedor, setEmpresaProveedor] = useState(null)
  const [proveedorActual, setProveedorActual] = useState(null)

  const [form, setForm] = useState({
    empresaCompradora: '',
    regla: '',
    vigenteDesde: '',
    vigenteHasta: '',
    sku: '',
    porcentaje: '',
  })

  const cargarBase = async () => {
  setLoading(true)
  setMsg('')

  // 1. Buscar la empresa del usuario logueado
  const { data: empresaData, error: empresaError } = await supabase
    .from('empresa')
    .select('id_empresa, nombre')
    .eq('id_empresa', session.id_empresa)
    .single()

  if (empresaError) {
    setMsg(`❌ Error cargando empresa proveedora: ${empresaError.message}`)
    setLoading(false)
    return
  }

  setEmpresaProveedor(empresaData)

  // 2. Buscar el proveedor asociado a esa empresa
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

  // 3. Cargar empresas compradoras, excluyendo la empresa proveedora actual
  const { data: empresasData, error: empresasError } = await supabase
    .from('empresa')
    .select('id_empresa, nombre')
    .eq('activo', true)
    .neq('id_empresa', session.id_empresa)
    .order('nombre', { ascending: true })

  if (empresasError) {
    setMsg(`❌ Error cargando empresas compradoras: ${empresasError.message}`)
    setLoading(false)
    return
  }

  setEmpresas(empresasData || [])

  // 4. Cargar SOLO reglas tarifa del proveedor actual
  const { data: reglasData, error: reglasError } = await supabase
    .from('tarifa_regla')
    .select('id_tarifa, nombre')
    .eq('id_proveedor', proveedorData.id_proveedor)
    .eq('activo', true)
    .order('nombre', { ascending: true })

  if (reglasError) {
    setMsg(`❌ Error cargando reglas de tarifa: ${reglasError.message}`)
    setLoading(false)
    return
  }

  setReglas(reglasData || [])

  // 5. Cargar SOLO productos que existen en almacenes del proveedor actual
  const { data: productosAlmacenData, error: productosError } = await supabase
    .from('producto_almacen')
    .select(`
      sku,
      stock,
      almacen:id_almacen (
        id_almacen,
        nombre,
        id_proveedor
      ),
      producto:sku (
        sku,
        nombre
      )
    `)
    .eq('activo', true)
    

  if (productosError) {
    setMsg(`❌ Error cargando productos del proveedor: ${productosError.message}`)
    setLoading(false)
    return
  }

  const productosFiltrados = (productosAlmacenData || [])
    .filter((item) => item.almacen?.id_proveedor === proveedorData.id_proveedor)
    .map((item) => ({
      sku: item.producto?.sku || item.sku,
      nombre: item.producto?.nombre || item.sku,
    }))

  // quitar duplicados por SKU
  const productosUnicos = productosFiltrados.filter(
    (producto, index, array) =>
      array.findIndex((p) => p.sku === producto.sku) === index
  )

  setProductos(productosUnicos)

  // 6. Cargar contratos
  const { data: contratosData, error: contratosError } = await supabase
    .from('v_contratos_activos')
    .select('*')
    .limit(100)

  if (contratosError) {
    setMsg(`❌ Error cargando contratos: ${contratosError.message}`)
    setContratos([])
  } else {
    setContratos(contratosData || [])
  }

  setLoading(false)
}

  useEffect(() => {
    cargarBase()
  }, [])

  const crearContrato = async () => {
    setMsg('')

    if (!empresaProveedor?.nombre) {
      setMsg('❌ No se pudo cargar la empresa proveedora actual.')
      return
    }

    if (!form.empresaCompradora || !form.regla || !form.vigenteDesde || !form.porcentaje) {
      setMsg('❌ Completa empresa compradora, regla, fecha desde y porcentaje.')
      return
    }

    const porcentaje = Number(form.porcentaje)

    if (porcentaje < 0 || porcentaje > 100) {
      setMsg('❌ El porcentaje debe estar entre 0 y 100.')
      return
    }

    const detalles = [
      {
        porcentaje_descuento: porcentaje,
        sku: form.sku || '',
      },
    ]

    const { error } = await supabase.rpc('f_agregar_contrato_empresa_detalle', {
      p_nombre_empresa: form.empresaCompradora,
      p_nombre_proveedor: empresaProveedor.nombre,
      p_nombre_regla: form.regla,
      p_vigente_desde: form.vigenteDesde,
      p_vigente_hasta: form.vigenteHasta || null,
      p_detalles: detalles,
    })

    if (error) {
      setMsg(`❌ Error creando contrato: ${error.message}`)
      return
    }

    setMsg('✅ Contrato creado correctamente. El descuento ya aplica a futuras órdenes.')
    setMostrarForm(false)
    setForm({
      empresaCompradora: '',
      regla: '',
      vigenteDesde: '',
      vigenteHasta: '',
      sku: '',
      porcentaje: '',
    })
    cargarBase()
  }

  return (
    <div>
      <PageHeader
        title="Contratos"
        subtitle="Crea descuentos directos para empresas compradoras"
        action={
          session?.rol === 'proveedor' && (
            <button style={styles.newBtn} onClick={() => setMostrarForm(true)}>
              + Crear contrato
            </button>
          )
        }
      />

      {msg && <div style={styles.msg}>{msg}</div>}

      {mostrarForm && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Nuevo contrato</h3>

          <div style={styles.grid}>
            <div>
              <label style={styles.label}>Empresa compradora</label>
              <select
                style={styles.input}
                value={form.empresaCompradora}
                onChange={(e) => setForm({ ...form, empresaCompradora: e.target.value })}
              >
                <option value="">Selecciona empresa</option>
                {empresas.map((e) => (
                  <option key={e.id_empresa} value={e.nombre}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={styles.label}>Regla de tarifa</label>
              <select
                style={styles.input}
                value={form.regla}
                onChange={(e) => setForm({ ...form, regla: e.target.value })}
              >
                <option value="">Selecciona regla</option>
                {reglas.map((r) => (
                  <option key={r.id_tarifa} value={r.nombre}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={styles.label}>Vigente desde</label>
              <input
                style={styles.input}
                type="datetime-local"
                value={form.vigenteDesde}
                onChange={(e) => setForm({ ...form, vigenteDesde: e.target.value })}
              />
            </div>

            <div>
              <label style={styles.label}>Vigente hasta</label>
              <input
                style={styles.input}
                type="datetime-local"
                value={form.vigenteHasta}
                onChange={(e) => setForm({ ...form, vigenteHasta: e.target.value })}
              />
            </div>

            <div>
              <label style={styles.label}>Producto específico</label>
              <select
                style={styles.input}
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              >
                <option value="">Todos los productos</option>
                {productos.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.sku} — {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={styles.label}>Descuento %</label>
              <input
                style={styles.input}
                type="number"
                min="0"
                max="100"
                value={form.porcentaje}
                onChange={(e) => setForm({ ...form, porcentaje: e.target.value })}
                placeholder="Ej: 10"
              />
            </div>
          </div>

          <div style={styles.actions}>
            <button style={styles.cancelBtn} onClick={() => setMostrarForm(false)}>
              Cancelar
            </button>

            <button style={styles.saveBtn} onClick={crearContrato}>
              Crear contrato
            </button>
          </div>
        </div>
      )}

      <DataTable
        data={contratos}
        loading={loading}
        emptyMsg="No hay contratos registrados."
      />
    </div>
  )
}

const styles = {
  newBtn: {
    background: '#1e293b',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
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
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '1rem',
  },
  cancelBtn: {
    padding: '10px 16px',
    background: '#fff',
    border: '1.5px solid #e2e8f0',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 16px',
    background: '#1e293b',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
}