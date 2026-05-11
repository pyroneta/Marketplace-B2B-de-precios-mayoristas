import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../AuthContext'

const ESTADO_COLORS = {
  pendiente: { bg: '#fef9c3', color: '#854d0e' },
  aprobado: { bg: '#dcfce7', color: '#166534' },
  cancelado: { bg: '#fee2e2', color: '#991b1b' },
  rechazado: { bg: '#f1f5f9', color: '#475569' },
}

export default function MisOrdenes() {
  const { session } = useAuth()

  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [procesando, setProcesando] = useState(null)

  const [mostrarForm, setMostrarForm] = useState(false)
  const [guardandoOrden, setGuardandoOrden] = useState(false)

  const [empresaActual, setEmpresaActual] = useState(null)
  const [sucursalActual, setSucursalActual] = useState(null)

  const [skuBusqueda, setSkuBusqueda] = useState('')
  const [buscandoSku, setBuscandoSku] = useState(false)

  const [productoEncontrado, setProductoEncontrado] = useState(null)
  const [opcionesStock, setOpcionesStock] = useState([])
  const [opcionElegida, setOpcionElegida] = useState(null)
  const [cantidad, setCantidad] = useState(1)

  const [productosOrden, setProductosOrden] = useState([])

  // ── Pricing state ──────────────────────────────────────────────
  const [precioInfo, setPrecioInfo] = useState(null)
  const [cargandoPrecio, setCargandoPrecio] = useState(false)

  const fetchOrdenes = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('v_ordenes_activas')
      .select('*')
      .limit(40)
    if (error) showToast(`❌ Error cargando órdenes: ${error.message}`, 'error')
    setOrdenes(data || [])
    setLoading(false)
  }

  const cargarDatosSesion = async () => {
    if (!session?.id_empresa || !session?.id_sucursal) {
      showToast('❌ Tu sesión no tiene id_empresa o id_sucursal. Revisa Login.jsx.', 'error')
      return
    }
    const { data: empresaData, error: empresaError } = await supabase
      .from('empresa')
      .select('id_empresa, nombre')
      .eq('id_empresa', session.id_empresa)
      .single()
    if (empresaError) { showToast(`❌ Error cargando empresa: ${empresaError.message}`, 'error'); return }

    const { data: sucursalData, error: sucursalError } = await supabase
      .from('sucursal_empresa')
      .select('id_sucursal, nombre, id_empresa')
      .eq('id_sucursal', session.id_sucursal)
      .single()
    if (sucursalError) { showToast(`❌ Error cargando sucursal: ${sucursalError.message}`, 'error'); return }

    setEmpresaActual(empresaData)
    setSucursalActual(sucursalData)
  }

  useEffect(() => {
    fetchOrdenes()
    cargarDatosSesion()
  }, [])

  // ── Auto-fetch pricing when provider + quantity changes ─────────
  useEffect(() => {
    if (opcionElegida && productoEncontrado && empresaActual) {
      buscarPreciosYDescuentos()
    } else {
      setPrecioInfo(null)
    }
  }, [opcionElegida, cantidad, productoEncontrado, empresaActual])

  const showToast = (msg, tipo = 'success') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 4500)
  }

  // ── Price & discount lookup ────────────────────────────────────
  const buscarPreciosYDescuentos = async () => {
    if (!opcionElegida || !productoEncontrado || !empresaActual) return
    setCargandoPrecio(true)
    setPrecioInfo(null)

    const sku = productoEncontrado.sku
    const id_proveedor = opcionElegida.id_proveedor
    const id_empresa = empresaActual.id_empresa
    const cantidadNum = Number(cantidad) || 1

    // 1. Precio base vigente
    const hoy = new Date().toISOString()
    const { data: precioData } = await supabase
      .from('precio_base')
      .select('precio_base, vigente_desde, vigente_hasta')
      .eq('sku', sku)
      .eq('id_proveedor', id_proveedor)
      .lte('vigente_desde', hoy)
      .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`)
      .order('vigente_desde', { ascending: false })
      .limit(1)

    const precioBase = precioData?.[0]?.precio_base ?? null

    // 2. Tarifa: buscar contrato activo empresa-proveedor → regla → tramo que aplica
    let descuentoTarifa = 0
    let tipoTramo = null
    let nombreRegla = null

    const { data: contratoData } = await supabase
      .from('contrato_empresa_tarifas')
      .select('id_contrato, id_regla, tarifa_regla:id_regla(id_tarifa, nombre)')
      .eq('id_empresa', id_empresa)
      .eq('id_proveedor', id_proveedor)
      .eq('activo', true)
      .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`)
      .lte('vigente_desde', hoy)
      .limit(1)

    if (contratoData?.[0]) {
      const id_regla = contratoData[0].id_regla
      nombreRegla = contratoData[0].tarifa_regla?.nombre || null

      // Buscar tramos de tipo 'volumen' (por cantidad) y 'costo' (por precio total)
      const { data: tramosData } = await supabase
        .from('tramo_tarifa')
        .select('tipo, cantidad_minima, cantidad_maxima, porcentaje_desc')
        .eq('id_regla', id_regla)
        .order('cantidad_minima', { ascending: true })

      if (tramosData?.length) {
        const subtotalEstimado = precioBase != null ? precioBase * cantidadNum : 0

        // Try volume tramo first
        const tramoVolumen = tramosData
          .filter((t) => t.tipo === 'volumen')
          .find(
            (t) =>
              cantidadNum >= Number(t.cantidad_minima) &&
              (t.cantidad_maxima == null || cantidadNum <= Number(t.cantidad_maxima))
          )

        // Try cost tramo
        const tramoCosto = tramosData
          .filter((t) => t.tipo === 'costo')
          .find(
            (t) =>
              subtotalEstimado >= Number(t.cantidad_minima) &&
              (t.cantidad_maxima == null || subtotalEstimado <= Number(t.cantidad_maxima))
          )

        // Use whichever gives bigger discount (or just the one that applies)
        const mejorTramo = [tramoVolumen, tramoCosto]
          .filter(Boolean)
          .sort((a, b) => Number(b.porcentaje_desc) - Number(a.porcentaje_desc))[0]

        if (mejorTramo) {
          descuentoTarifa = Number(mejorTramo.porcentaje_desc)
          tipoTramo = mejorTramo.tipo
        }
      }
    }

    // 3. Descuento contrato por SKU o general (contrato_empresa_detalle)
    let descuentoContrato = 0
    let origenContrato = null

    if (contratoData?.[0]) {
      const id_contrato = contratoData[0].id_contrato

      // Look for SKU-specific first, then null-SKU (general)
      const { data: detalleData } = await supabase
        .from('contrato_empresa_detalle')
        .select('porcentaje_descuento, sku')
        .eq('id_contrato', id_contrato)
        .or(`sku.eq.${sku},sku.is.null`)
        .order('sku', { ascending: false, nullsFirst: false }) // SKU-specific first
        .limit(2)

      if (detalleData?.length) {
        const especifico = detalleData.find((d) => d.sku === sku)
        const general = detalleData.find((d) => d.sku == null)
        const elegido = especifico || general
        if (elegido) {
          descuentoContrato = Number(elegido.porcentaje_descuento)
          origenContrato = especifico ? `SKU ${sku}` : 'general del contrato'
        }
      }
    }

    const descuentoTotal = descuentoTarifa + descuentoContrato
    const precioFinal =
      precioBase != null ? precioBase * (1 - descuentoTotal / 100) : null

    setCargandoPrecio(false)
    setPrecioInfo({
      precioBase,
      descuentoTarifa,
      tipoTramo,
      nombreRegla,
      descuentoContrato,
      origenContrato,
      descuentoTotal,
      precioFinal,
    })
  }

  const limpiarFormulario = () => {
    setSkuBusqueda('')
    setBuscandoSku(false)
    setProductoEncontrado(null)
    setOpcionesStock([])
    setOpcionElegida(null)
    setCantidad(1)
    setProductosOrden([])
    setPrecioInfo(null)
  }

  const limpiarBusquedaProducto = () => {
    setSkuBusqueda('')
    setProductoEncontrado(null)
    setOpcionesStock([])
    setOpcionElegida(null)
    setCantidad(1)
    setPrecioInfo(null)
  }

  const abrirFormulario = () => { limpiarFormulario(); setMostrarForm(true) }
  const cerrarFormulario = () => { limpiarFormulario(); setMostrarForm(false) }

  const cambiarEstado = async (id_orden, nuevoEstado, triggerDesc) => {
    if (!id_orden) { showToast('❌ No se encontró el ID de la orden. Revisa v_ordenes_activas.', 'error'); return }
    setProcesando(id_orden)
    const { error } = await supabase.from('orden_compra').update({ id_estado: nuevoEstado }).eq('id_orden', id_orden)
    setProcesando(null)
    if (error) showToast(`❌ Error: ${error.message}`, 'error')
    else { showToast(`✅ Orden "${nuevoEstado}". ${triggerDesc}`, 'success'); fetchOrdenes() }
  }

  const buscarProductoPorSku = async () => {
    const sku = skuBusqueda.trim()
    if (!sku) { showToast('❌ Escribe un SKU para buscar.', 'error'); return }
    setBuscandoSku(true)
    setProductoEncontrado(null)
    setOpcionesStock([])
    setOpcionElegida(null)
    setPrecioInfo(null)

    const { data: productoData, error: productoError } = await supabase
      .from('producto')
      .select('sku, nombre, descripcion, unidad_medida')
      .eq('sku', sku)
      .eq('activo', true)
      .single()

    if (productoError || !productoData) {
      setBuscandoSku(false)
      showToast('❌ No se encontró un producto activo con ese SKU.', 'error')
      return
    }

    const { data: stockData, error: stockError } = await supabase
      .from('producto_almacen')
      .select(`sku, stock, id_almacen, almacen:id_almacen (id_almacen, nombre, id_proveedor, proveedor:id_proveedor (id_proveedor, empresa:id_empresa (id_empresa, nombre)))`)
      .eq('sku', sku)
      .eq('activo', true)
      .gt('stock', 0)

    setBuscandoSku(false)
    if (stockError) { showToast(`❌ Error buscando stock: ${stockError.message}`, 'error'); return }

    const opciones = (stockData || [])
      .filter((item) => item.almacen && item.almacen.proveedor && item.almacen.proveedor.empresa)
      .map((item) => ({
        sku: item.sku,
        stock: Number(item.stock),
        id_almacen: item.id_almacen,
        nombre_almacen: item.almacen.nombre,
        id_proveedor: item.almacen.proveedor.id_proveedor,
        nombre_proveedor: item.almacen.proveedor.empresa.nombre,
      }))

    setProductoEncontrado(productoData)
    setOpcionesStock(opciones)
    if (opciones.length === 0) showToast('⚠️ Producto encontrado, pero no tiene stock disponible.', 'error')
  }

  const agregarProductoAOrden = () => {
    if (!productoEncontrado || !opcionElegida) { showToast('❌ Primero busca un SKU y elige un proveedor/almacén disponible.', 'error'); return }
    const cantidadNumero = Number(cantidad)
    if (!cantidadNumero || cantidadNumero <= 0) { showToast('❌ La cantidad debe ser mayor a 0.', 'error'); return }
    if (cantidadNumero > Number(opcionElegida.stock)) { showToast(`❌ La cantidad supera el stock disponible (${opcionElegida.stock}).`, 'error'); return }

    if (productosOrden.length > 0) {
      const primerProducto = productosOrden[0]
      if (primerProducto.id_almacen !== opcionElegida.id_almacen || primerProducto.id_proveedor !== opcionElegida.id_proveedor) {
        showToast('❌ Todos los productos de una misma orden deben ser del mismo proveedor y almacén.', 'error')
        return
      }
    }

    const productoExistente = productosOrden.find((p) => p.sku === productoEncontrado.sku)
    if (productoExistente) {
      const nuevaCantidad = Number(productoExistente.cantidad) + cantidadNumero
      if (nuevaCantidad > Number(opcionElegida.stock)) {
        showToast(`❌ Ya agregaste ${productoExistente.cantidad}. No puedes superar el stock disponible (${opcionElegida.stock}).`, 'error')
        return
      }
      setProductosOrden((prev) => prev.map((p) => p.sku === productoEncontrado.sku ? { ...p, cantidad: nuevaCantidad } : p))
    } else {
      setProductosOrden((prev) => [
        ...prev,
        {
          sku: productoEncontrado.sku,
          nombre: productoEncontrado.nombre,
          cantidad: cantidadNumero,
          stock: opcionElegida.stock,
          id_almacen: opcionElegida.id_almacen,
          nombre_almacen: opcionElegida.nombre_almacen,
          id_proveedor: opcionElegida.id_proveedor,
          nombre_proveedor: opcionElegida.nombre_proveedor,
          precioBase: precioInfo?.precioBase ?? null,
          precioFinal: precioInfo?.precioFinal ?? null,
          descuentoTotal: precioInfo?.descuentoTotal ?? 0,
        },
      ])
    }

    limpiarBusquedaProducto()
    showToast('✅ Producto agregado a la orden.', 'success')
  }

  const quitarProductoDeOrden = (sku) => {
    setProductosOrden((prev) => prev.filter((p) => p.sku !== sku))
  }

  const crearOrden = async () => {
    if (!empresaActual || !sucursalActual || !session?.nombre) { showToast('❌ No se pudo obtener empresa, sucursal o usuario de la sesión.', 'error'); return }
    if (productosOrden.length === 0) { showToast('❌ Agrega al menos un producto a la orden.', 'error'); return }

    const datosProveedorAlmacen = productosOrden[0]
    const productosLista = productosOrden.map((p) => ({ sku: p.sku, cantidad: p.cantidad }))
    setGuardandoOrden(true)



//OOOOOOOOOOOOOOOOOOOOO

    
    const { error } = await supabase.rpc('f_agregar_orden_compra', {
      p_nombre_empresa_compradora: empresaActual.nombre,
      p_nombre_empresa_proveedora: datosProveedorAlmacen.nombre_proveedor,
      p_nombre_sucursal: sucursalActual.nombre,
      p_nombre_almacen: datosProveedorAlmacen.nombre_almacen,
      p_nombre_usuario: session.nombre,
      p_productos_lista: productosLista,
    })

//OOOOOOOOOOOOOOOOOOOOO

    setGuardandoOrden(false)
    if (error) { showToast(`❌ Error creando orden: ${error.message}`, 'error'); return }
    showToast('✅ Orden creada correctamente. Estado inicial: pendiente.', 'success')
    cerrarFormulario()
    fetchOrdenes()
  }

  const formatBOB = (val) =>
    Number(val).toLocaleString('es-BO', { style: 'currency', currency: 'BOB' })

  return (
    <div>
      <PageHeader
  title="Órdenes de compra"
  subtitle="Crea órdenes nuevas y cambia estados para disparar los triggers de la BD"
  action={
    <div style={styles.headerActions}>
      {session?.rol !== 'proveedor' && (
        <button onClick={abrirFormulario} style={styles.newBtn}>
          + Añadir nueva orden
        </button>
      )}

      <button onClick={fetchOrdenes} style={styles.refreshBtn}>
        ↺ Actualizar
      </button>
    </div>
  }
/>

      {toast && (
        <div style={{ ...styles.toast, background: toast.tipo === 'error' ? '#fef2f2' : '#f0fdf4', borderColor: toast.tipo === 'error' ? '#fca5a5' : '#86efac' }}>
          <span style={{ color: toast.tipo === 'error' ? '#dc2626' : '#16a34a' }}>{toast.msg}</span>
        </div>
      )}

      {mostrarForm && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <p style={styles.modalTitle}>Añadir nueva orden</p>
                <p style={styles.modalSub}>Busca productos por SKU, agrégalos a la orden y confirma.</p>
              </div>
              <button style={styles.closeBtn} onClick={cerrarFormulario}>×</button>
            </div>

            <div style={styles.autoInfo}>
              <div><span style={styles.autoLabel}>Empresa compradora</span><strong>{empresaActual?.nombre || 'Cargando...'}</strong></div>
              <div><span style={styles.autoLabel}>Sucursal compradora</span><strong>{sucursalActual?.nombre || 'Cargando...'}</strong></div>
              <div><span style={styles.autoLabel}>Usuario comprador</span><strong>{session?.nombre || 'Cargando...'}</strong></div>
            </div>

            <div style={styles.searchBox}>
              <label style={styles.label}>Buscar producto por SKU</label>
              <div style={styles.searchRow}>
                <input style={styles.input} value={skuBusqueda} onChange={(e) => setSkuBusqueda(e.target.value)} placeholder="Ej: PROD-ORD-001" />
                <button style={styles.searchBtn} onClick={buscarProductoPorSku} disabled={buscandoSku}>{buscandoSku ? 'Buscando...' : 'Buscar'}</button>
              </div>
            </div>

            {productoEncontrado && (
              <div style={styles.productCard}>
                <p style={styles.productTitle}>{productoEncontrado.sku} — {productoEncontrado.nombre}</p>
                <p style={styles.productDesc}>{productoEncontrado.descripcion || 'Sin descripción'}</p>
                <p style={styles.productUnit}>Unidad: {productoEncontrado.unidad_medida || '—'}</p>
              </div>
            )}

            {opcionesStock.length > 0 && (
              <div style={styles.stockBox}>
                <p style={styles.sectionTitle}>Disponible en:</p>
                <div style={styles.optionsGrid}>
                  {opcionesStock.map((opcion) => {
                    const selected = opcionElegida?.id_almacen === opcion.id_almacen && opcionElegida?.id_proveedor === opcion.id_proveedor
                    return (
                      <button
                        key={`${opcion.id_almacen}-${opcion.id_proveedor}`}
                        style={{ ...styles.optionCard, borderColor: selected ? '#1e293b' : '#e2e8f0', background: selected ? '#f8fafc' : '#fff' }}
                        onClick={() => setOpcionElegida(opcion)}
                      >
                        <span style={styles.optionProvider}>{opcion.nombre_proveedor}</span>
                        <span style={styles.optionWarehouse}>Almacén: {opcion.nombre_almacen}</span>
                        <span style={styles.optionStock}>Stock disponible: {opcion.stock}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {opcionElegida && (
              <div style={styles.quantityBox}>
                <label style={styles.label}>Cantidad a comprar</label>
                <div style={styles.addRow}>
                  <input style={styles.qtyInput} type="number" min="1" max={opcionElegida.stock} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
                  <button style={styles.addBtn} onClick={agregarProductoAOrden}>Agregar producto</button>
                </div>
                <p style={styles.quantityHint}>Máximo disponible en este almacén: {opcionElegida.stock}</p>
              </div>
            )}

            {/* ── Precio y descuentos ─────────────────────────────── */}
            {opcionElegida && (
              <div style={styles.precioBox}>
                {cargandoPrecio ? (
                  <p style={styles.precioLoading}>Consultando precios y descuentos...</p>
                ) : precioInfo ? (
                  <>
                    <p style={styles.precioTitulo}>Desglose de precio</p>
                    <div style={styles.precioGrid}>
                      <div style={styles.precioFila}>
                        <span style={styles.precioLabel}>Precio base unitario</span>
                        <span style={styles.precioValor}>
                          {precioInfo.precioBase != null ? formatBOB(precioInfo.precioBase) : <em style={{ color: '#94a3b8' }}>Sin precio configurado</em>}
                        </span>
                      </div>

                      {precioInfo.descuentoTarifa > 0 && (
                        <div style={{ ...styles.precioFila, ...styles.precioDescuento }}>
                          <span style={styles.precioLabel}>
                            Descuento tarifa
                            {precioInfo.tipoTramo && <span style={styles.tramoBadge}>{precioInfo.tipoTramo}</span>}
                            {precioInfo.nombreRegla && <span style={{ color: '#64748b', fontSize: '11px' }}> · {precioInfo.nombreRegla}</span>}
                          </span>
                          <span style={{ ...styles.precioValor, color: '#16a34a', fontWeight: '700' }}>
                            −{precioInfo.descuentoTarifa}%
                          </span>
                        </div>
                      )}

                      {precioInfo.descuentoTarifa === 0 && (
                        <div style={styles.precioFila}>
                          <span style={{ ...styles.precioLabel, color: '#94a3b8' }}>Descuento tarifa</span>
                          <span style={{ ...styles.precioValor, color: '#94a3b8' }}>Sin descuento aplicable</span>
                        </div>
                      )}

                      {precioInfo.descuentoContrato > 0 && (
                        <div style={{ ...styles.precioFila, ...styles.precioDescuento }}>
                          <span style={styles.precioLabel}>
                            Descuento contrato
                            {precioInfo.origenContrato && <span style={{ color: '#64748b', fontSize: '11px' }}> · {precioInfo.origenContrato}</span>}
                          </span>
                          <span style={{ ...styles.precioValor, color: '#16a34a', fontWeight: '700' }}>
                            −{precioInfo.descuentoContrato}%
                          </span>
                        </div>
                      )}

                      {precioInfo.descuentoContrato === 0 && (
                        <div style={styles.precioFila}>
                          <span style={{ ...styles.precioLabel, color: '#94a3b8' }}>Descuento contrato</span>
                          <span style={{ ...styles.precioValor, color: '#94a3b8' }}>Sin descuento aplicable</span>
                        </div>
                      )}

                      {(precioInfo.descuentoTarifa > 0 || precioInfo.descuentoContrato > 0) && (
                        <div style={{ ...styles.precioFila, borderTop: '1.5px solid #e2e8f0', marginTop: '4px', paddingTop: '10px' }}>
                          <span style={{ ...styles.precioLabel, fontWeight: '700', color: '#0f172a' }}>Descuento total</span>
                          <span style={{ ...styles.precioValor, color: '#16a34a', fontWeight: '700', fontSize: '15px' }}>
                            −{precioInfo.descuentoTotal}%
                          </span>
                        </div>
                      )}

                      {precioInfo.precioFinal != null && (
                        <div style={{ ...styles.precioFila, background: '#f0fdf4', borderRadius: '8px', padding: '10px 12px', marginTop: '4px' }}>
                          <span style={{ ...styles.precioLabel, fontWeight: '700', color: '#166534' }}>Precio final unitario</span>
                          <span style={{ ...styles.precioValor, color: '#166534', fontWeight: '800', fontSize: '16px' }}>
                            {formatBOB(precioInfo.precioFinal)}
                          </span>
                        </div>
                      )}

                      {precioInfo.precioBase != null && Number(cantidad) > 0 && (
                        <div style={{ ...styles.precioFila, background: '#eff6ff', borderRadius: '8px', padding: '10px 12px', marginTop: '4px' }}>
                          <span style={{ ...styles.precioLabel, fontWeight: '700', color: '#1e40af' }}>
                            Subtotal estimado ({cantidad} u.)
                          </span>
                          <span style={{ ...styles.precioValor, color: '#1e40af', fontWeight: '800', fontSize: '16px' }}>
                            {formatBOB((precioInfo.precioFinal ?? precioInfo.precioBase) * Number(cantidad))}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {productosOrden.length > 0 && (
              <div style={styles.orderList}>
                <p style={styles.sectionTitle}>Productos agregados a la orden</p>
                {productosOrden.map((p) => (
                  <div key={p.sku} style={styles.orderItem}>
                    <div>
                      <strong>{p.sku}</strong> — {p.nombre}
                      <br />
                      <span>Cantidad: {p.cantidad} | Proveedor: {p.nombre_proveedor} | Almacén: {p.nombre_almacen}</span>
                      {p.precioFinal != null && (
                        <span style={{ marginLeft: '8px', color: '#166534', fontWeight: '600' }}>
                          · {formatBOB(p.precioFinal)}/u {p.descuentoTotal > 0 ? `(−${p.descuentoTotal}%)` : ''}
                        </span>
                      )}
                    </div>
                    <button style={styles.removeBtn} onClick={() => quitarProductoDeOrden(p.sku)}>Quitar</button>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={cerrarFormulario}>Cancelar</button>
              <button style={styles.saveBtn} onClick={crearOrden} disabled={guardandoOrden || productosOrden.length === 0}>
                {guardandoOrden ? 'Creando...' : 'Crear orden'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.triggerInfo}>
        <p style={styles.triggerTitle}>Flujo activo en esta pantalla</p>
        <div style={styles.triggerGrid}>
          <div style={styles.triggerItem}><span style={styles.triggerBadge}>Nuevo</span><span>Buscar SKU → agregar productos → crear orden pendiente</span></div>
          <div style={styles.triggerItem}><span style={styles.triggerBadge}>T2</span><span>Cancelar → revierte stock en almacén automáticamente</span></div>
          <div style={styles.triggerItem}><span style={styles.triggerBadge}>T3</span><span>Aprobar → genera factura pendiente automáticamente</span></div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Cargando órdenes...</p>
      ) : ordenes.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>No hay órdenes activas.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>Fecha</th>
                <th style={styles.th}>Proveedor</th>
                <th style={styles.th}>Empresa compradora</th>
                <th style={styles.th}>Usuario</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((o, i) => {
                const estilo = ESTADO_COLORS[o.estado_orden] || ESTADO_COLORS.pendiente
                return (
                  <tr key={o.id_orden || i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={styles.td}>{o.fecha_creacion ? new Date(o.fecha_creacion).toLocaleDateString('es-BO') : '—'}</td>
                    <td style={styles.td}>{o.proveedor}</td>
                    <td style={styles.td}>{o.empresa_compradora}</td>
                    <td style={styles.td}>{o.usuario_comprador}</td>
                    <td style={{ ...styles.td, fontWeight: '600' }}>{Number(o.total || 0).toLocaleString('es-BO', { style: 'currency', currency: 'BOB' })}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, background: estilo.bg, color: estilo.color }}>{o.estado_orden}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actions}>
                        {session?.rol === 'proveedor' && o.estado_orden === 'pendiente' && (
                          <>
                            <button disabled={procesando === o.id_orden} onClick={() => cambiarEstado(o.id_orden, 'aprobado', 'Trigger T3: factura generada.')} style={{ ...styles.actionBtn, background: '#dcfce7', color: '#166534' }}>Aprobar</button>
                            <button disabled={procesando === o.id_orden} onClick={() => cambiarEstado(o.id_orden, 'rechazado', 'Orden rechazada.')} style={{ ...styles.actionBtn, background: '#f1f5f9', color: '#475569' }}>Rechazar</button>
                          </>
                        )}
                        {session?.rol !== 'proveedor' && (o.estado_orden === 'pendiente' || o.estado_orden === 'aprobado') && (
                          <button disabled={procesando === o.id_orden} onClick={() => cambiarEstado(o.id_orden, 'cancelado', o.estado_orden === 'aprobado' ? 'Factura anulada y stock devuelto.' : 'Stock revertido.')} style={{ ...styles.actionBtn, background: '#fee2e2', color: '#991b1b' }}>Cancelar</button>
                        )}
                        {(o.estado_orden === 'cancelado' || o.estado_orden === 'rechazado') && <span style={styles.noActions}>Sin acciones</span>}
                        {session?.rol === 'proveedor' && o.estado_orden !== 'pendiente' && <span style={styles.noActions}>Sin acciones</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const styles = {
  headerActions: { display: 'flex', gap: '8px' },
  newBtn: { background: '#1e293b', border: '1px solid #1e293b', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', color: '#fff', fontWeight: '600' },
  refreshBtn: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', color: '#475569' },
  toast: { border: '1px solid', borderRadius: '8px', padding: '12px 16px', marginBottom: '1rem', fontSize: '14px' },
  triggerInfo: { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem' },
  triggerTitle: { margin: '0 0 8px', fontWeight: '600', fontSize: '13px', color: '#1e40af' },
  triggerGrid: { display: 'flex', flexDirection: 'column', gap: '4px' },
  triggerItem: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#1e3a8a' },
  triggerBadge: { background: '#1e40af', color: '#fff', borderRadius: '4px', padding: '1px 7px', fontSize: '11px', fontWeight: '700', flexShrink: 0 },
  tableWrap: { overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  thead: { background: '#f8fafc' },
  th: { padding: '11px 14px', textAlign: 'left', fontWeight: '600', color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' },
  td: { padding: '10px 14px', color: '#334155', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' },
  badge: { padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600' },
  actions: { display: 'flex', gap: '6px' },
  actionBtn: { border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  noActions: { color: '#94a3b8', fontSize: '12px', fontWeight: '600' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' },
  modal: { background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '800px', padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' },
  modalTitle: { margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a' },
  modalSub: { margin: '4px 0 0', fontSize: '13px', color: '#64748b' },
  closeBtn: { border: 'none', background: '#f1f5f9', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '20px', color: '#475569' },
  autoInfo: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', marginBottom: '1rem', fontSize: '13px', color: '#0f172a' },
  autoLabel: { display: 'block', color: '#64748b', fontSize: '11px', marginBottom: '3px' },
  searchBox: { marginBottom: '1rem' },
  searchRow: { display: 'grid', gridTemplateColumns: '1fr 110px', gap: '8px' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' },
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', color: '#0f172a', outline: 'none', boxSizing: 'border-box', background: '#fff' },
  searchBtn: { background: '#1e293b', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  productCard: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', marginBottom: '1rem' },
  productTitle: { margin: '0 0 4px', fontWeight: '700', color: '#0f172a' },
  productDesc: { margin: '0 0 4px', fontSize: '13px', color: '#64748b' },
  productUnit: { margin: 0, fontSize: '12px', color: '#94a3b8' },
  stockBox: { marginTop: '1rem' },
  sectionTitle: { margin: '0 0 0.75rem', fontWeight: '700', fontSize: '14px', color: '#0f172a' },
  optionsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  optionCard: { textAlign: 'left', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px', cursor: 'pointer' },
  optionProvider: { display: 'block', fontWeight: '700', color: '#0f172a', marginBottom: '4px' },
  optionWarehouse: { display: 'block', fontSize: '13px', color: '#475569', marginBottom: '3px' },
  optionStock: { display: 'block', fontSize: '12px', color: '#166534', fontWeight: '600' },
  quantityBox: { marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' },
  addRow: { display: 'flex', gap: '8px', alignItems: 'center' },
  qtyInput: { width: '130px', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', color: '#0f172a', outline: 'none', boxSizing: 'border-box' },
  addBtn: { padding: '10px 14px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  quantityHint: { margin: '6px 0 0', color: '#64748b', fontSize: '12px' },
  // ── Precio ──
  precioBox: { marginTop: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px' },
  precioLoading: { margin: 0, fontSize: '13px', color: '#64748b' },
  precioTitulo: { margin: '0 0 10px', fontWeight: '700', fontSize: '13px', color: '#0f172a' },
  precioGrid: { display: 'flex', flexDirection: 'column', gap: '6px' },
  precioFila: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', fontSize: '13px' },
  precioDescuento: { background: '#f0fdf4', borderRadius: '6px', padding: '4px 8px' },
  precioLabel: { color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  precioValor: { fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap' },
  tramoBadge: { background: '#1e40af', color: '#fff', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: '700' },
  // ──
  orderList: { marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' },
  orderItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', marginBottom: '8px', fontSize: '13px', color: '#334155' },
  removeBtn: { border: 'none', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  modalActions: { marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '8px' },
  cancelBtn: { padding: '10px 16px', background: '#fff', border: '1.5px solid #e2e8f0', color: '#475569', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  saveBtn: { padding: '10px 16px', background: '#1e293b', border: 'none', color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
}
