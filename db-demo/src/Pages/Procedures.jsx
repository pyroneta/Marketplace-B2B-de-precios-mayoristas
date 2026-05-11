import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import PageHeader from '../components/PageHeader'

export default function Procedures() {
  const { session } = useAuth()
  const isProveedor = session?.rol === 'proveedor'

  const [activeProc, setActiveProc] = useState(isProveedor ? 'orden' : 'orden_empresa')
  const [toast, setToast]     = useState(null)
  const [loading, setLoading] = useState(false)

  const showToast = (msg, tipo = 'success') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 5000)
  }

  // ─── PROVEEDOR: SP_CREAR_ORDEN_COMPRA ──────────────────────────────────────
  const [orden, setOrden] = useState({
    id_proveedor:          '',
    id_empresa_compradora: '',
    id_sucursal:           '',
    detalles: '[{"sku":"SKU001","cantidad":5,"precio_unitario":100}]',
  })

  const crearOrden = async () => {
    setLoading(true)
    try {
      const detalles = JSON.parse(orden.detalles)
      const { error } = await supabase.rpc('sp_crear_orden_compra', {
        p_id_proveedor:          orden.id_proveedor,
        p_id_empresa_compradora: orden.id_empresa_compradora,
        p_id_sucursal:           orden.id_sucursal,
        p_detalles:              detalles,
      })
      if (error) showToast(`❌ ${error.message}`, 'error')
      else showToast('✅ Orden creada. Verificá en "Mis órdenes" → estado pendiente.', 'success')
    } catch (e) {
      showToast(`❌ JSON inválido en detalles: ${e.message}`, 'error')
    }
    setLoading(false)
  }

  // ─── PROVEEDOR: SP_AGREGAR_REGLA_TARIFA_CON_TRAMOS ────────────────────────
  const [regla, setRegla] = useState({
    nombre: '',
    descripcion: '',
    nombre_proveedor: '',
    tramos: JSON.stringify([
      { tipo: 'volumen', cantidad_minima: 0,   cantidad_maxima: 100,  porcentaje_desc: 5  },
      { tipo: 'volumen', cantidad_minima: 101,  cantidad_maxima: null, porcentaje_desc: 10 },
    ], null, 2),
  })

  const crearRegla = async () => {
    setLoading(true)
    try {
      const tramos = JSON.parse(regla.tramos)
      const { error } = await supabase.rpc('sp_agregar_regla_tarifa_con_tramos', {
        p_nombre:            regla.nombre,
        p_descripcion:       regla.descripcion,
        p_nombre_proveedor:  regla.nombre_proveedor,
        p_tramos:            tramos,
      })
      if (error) showToast(`❌ ${error.message}`, 'error')
      else showToast('✅ Regla de tarifa creada. El Trigger T7 validó que no haya solapamiento entre tramos.', 'success')
    } catch (e) {
      showToast(`❌ JSON inválido en tramos: ${e.message}`, 'error')
    }
    setLoading(false)
  }

  // ─── EMPRESA: SP_AGREGAR_ORDEN_COMPRA (orden desde empresa compradora) ─────
  const [ordenEmpresa, setOrdenEmpresa] = useState({
    id_proveedor: '',
    id_sucursal:  '',
    detalles: '[{"sku":"SKU001","cantidad":2,"precio_unitario":100}]',
  })

  const crearOrdenEmpresa = async () => {
    setLoading(true)
    try {
      const detalles = JSON.parse(ordenEmpresa.detalles)
      const { error } = await supabase.rpc('sp_crear_orden_compra', {
        p_id_proveedor:          ordenEmpresa.id_proveedor,
        p_id_empresa_compradora: session?.id_empresa,
        p_id_sucursal:           ordenEmpresa.id_sucursal,
        p_detalles:              detalles,
      })
      if (error) showToast(`❌ ${error.message}`, 'error')
      else showToast('✅ Orden creada. Tu empresa quedó registrada como compradora. Revisá "Mis órdenes".', 'success')
    } catch (e) {
      showToast(`❌ JSON inválido en detalles: ${e.message}`, 'error')
    }
    setLoading(false)
  }

  // ─── EMPRESA: SP_AGREGAR_CONTRATO_EMPRESA_DETALLE ─────────────────────────
  const [contrato, setContrato] = useState({
    nombre_proveedor: '',
    nombre_regla:     '',
    vigente_desde:    new Date().toISOString().slice(0, 16),
    vigente_hasta:    '',
    detalles: JSON.stringify([
      { sku: 'SKU001', porcentaje_descuento: 10 },
    ], null, 2),
  })

  const crearContrato = async () => {
    setLoading(true)
    try {
      // Obtenemos el nombre de la empresa del usuario logueado
      const { data: emp } = await supabase
        .from('empresa')
        .select('nombre')
        .eq('id_empresa', session?.id_empresa)
        .single()

      const detalles = JSON.parse(contrato.detalles)
      const { error } = await supabase.rpc('sp_agregar_contrato_empresa_detalle', {
        p_nombre_empresa:   emp?.nombre ?? '',
        p_nombre_proveedor: contrato.nombre_proveedor,
        p_nombre_regla:     contrato.nombre_regla,
        p_vigente_desde:    contrato.vigente_desde,
        p_vigente_hasta:    contrato.vigente_hasta || null,
        p_detalles:         detalles,
      })
      if (error) showToast(`❌ ${error.message}`, 'error')
      else showToast('✅ Contrato creado correctamente. Podés verlo en "Contratos".', 'success')
    } catch (e) {
      showToast(`❌ ${e.message}`, 'error')
    }
    setLoading(false)
  }

  // ─── TAB CONFIG ───────────────────────────────────────────────────────────
  const proveedorProcs = [
    { key: 'orden', label: 'Crear orden de compra', icon: '📦', sp: 'SP_CREAR_ORDEN_COMPRA' },
    { key: 'regla', label: 'Agregar regla de tarifa', icon: '📊', sp: 'SP_AGREGAR_REGLA_TARIFA_CON_TRAMOS' },
  ]

  const empresaProcs = [
    { key: 'orden_empresa', label: 'Crear orden de compra', icon: '🛒', sp: 'SP_CREAR_ORDEN_COMPRA' },
    { key: 'contrato',      label: 'Crear contrato',        icon: '📄', sp: 'SP_AGREGAR_CONTRATO_EMPRESA_DETALLE' },
  ]

  const procs = isProveedor ? proveedorProcs : empresaProcs

  return (
    <div>
      <PageHeader
        title="Stored Procedures"
        subtitle={`Ejecutá procedures como ${isProveedor ? 'proveedor' : 'empresa compradora'}`}
      />

      {toast && (
        <div style={{ ...styles.toast,
          background:   toast.tipo === 'error' ? '#fef2f2' : '#f0fdf4',
          borderColor:  toast.tipo === 'error' ? '#fca5a5' : '#86efac',
        }}>
          <p style={{ margin: 0, color: toast.tipo === 'error' ? '#dc2626' : '#166534', fontSize: '14px' }}>
            {toast.msg}
          </p>
        </div>
      )}

      <div style={styles.tabs}>
        {procs.map(p => (
          <button key={p.key} onClick={() => setActiveProc(p.key)}
            style={{ ...styles.tab, ...(activeProc === p.key ? styles.tabActive : {}) }}>
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {/* ── PROVEEDOR: Crear orden ── */}
      {activeProc === 'orden' && (
        <div style={styles.card}>
          <CardHead title="SP_CREAR_ORDEN_COMPRA" sub="Crea una orden de compra con detalles. Valida stock disponible." badge="Procedure" />
          <div style={styles.form}>
            <Field label="UUID Proveedor"          value={orden.id_proveedor}          onChange={v => setOrden({ ...orden, id_proveedor: v })}          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            <Field label="UUID Empresa compradora" value={orden.id_empresa_compradora} onChange={v => setOrden({ ...orden, id_empresa_compradora: v })} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            <Field label="UUID Sucursal"           value={orden.id_sucursal}           onChange={v => setOrden({ ...orden, id_sucursal: v })}           placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            <TextareaField label="Detalles (JSON)" hint="Array con sku, cantidad y precio_unitario" value={orden.detalles} onChange={v => setOrden({ ...orden, detalles: v })} rows={5} />
          </div>
          <ExecBtn loading={loading} label="SP_CREAR_ORDEN_COMPRA" onClick={crearOrden} />
        </div>
      )}

      {/* ── PROVEEDOR: Regla de tarifa ── */}
      {activeProc === 'regla' && (
        <div style={styles.card}>
          <CardHead title="SP_AGREGAR_REGLA_TARIFA_CON_TRAMOS" sub="Crea una regla de tarifa con sus tramos. El Trigger T7 valida que no se solapan rangos." badge="Procedure + Trigger T7" badgeColor="#f59e0b" />
          <div style={styles.triggerNote}>
            <strong>Trigger T7 activo:</strong> Si dos tramos del mismo tipo tienen rangos solapados, la BD lanza una excepción y revierte. Probalo editando el JSON para crear tramos solapados.
          </div>
          <div style={styles.form}>
            <Field label="Nombre de la regla"              value={regla.nombre}            onChange={v => setRegla({ ...regla, nombre: v })}            placeholder="Ej: Descuento por volumen Q1" />
            <Field label="Descripción"                     value={regla.descripcion}       onChange={v => setRegla({ ...regla, descripcion: v })}       placeholder="Descripción opcional" />
            <Field label="Nombre del proveedor (razon_social)" value={regla.nombre_proveedor} onChange={v => setRegla({ ...regla, nombre_proveedor: v })} placeholder="Ej: Distribuidora XYZ S.A." />
            <TextareaField label="Tramos (JSON)" hint='tipo: "volumen" o "costo" | cantidad_maxima: null = sin límite' value={regla.tramos} onChange={v => setRegla({ ...regla, tramos: v })} rows={8} />
          </div>
          <ExecBtn loading={loading} label="SP_AGREGAR_REGLA_TARIFA_CON_TRAMOS" onClick={crearRegla} />
        </div>
      )}

      {/* ── EMPRESA: Crear orden ── */}
      {activeProc === 'orden_empresa' && (
        <div style={styles.card}>
          <CardHead title="SP_CREAR_ORDEN_COMPRA" sub="Crea una orden de compra. Tu empresa queda registrada automáticamente como compradora." badge="Procedure" />
          <div style={styles.infoNote}>
            <strong>Tu empresa:</strong> {session?.id_empresa ?? '—'} · El sistema la usa automáticamente como empresa compradora.
          </div>
          <div style={styles.form}>
            <Field label="UUID Proveedor" value={ordenEmpresa.id_proveedor} onChange={v => setOrdenEmpresa({ ...ordenEmpresa, id_proveedor: v })} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            <Field label="UUID Sucursal"  value={ordenEmpresa.id_sucursal}  onChange={v => setOrdenEmpresa({ ...ordenEmpresa, id_sucursal: v })}  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            <TextareaField label="Detalles (JSON)" hint="Array con sku, cantidad y precio_unitario" value={ordenEmpresa.detalles} onChange={v => setOrdenEmpresa({ ...ordenEmpresa, detalles: v })} rows={5} />
          </div>
          <ExecBtn loading={loading} label="SP_CREAR_ORDEN_COMPRA" onClick={crearOrdenEmpresa} />
        </div>
      )}

      {/* ── EMPRESA: Crear contrato ── */}
      {activeProc === 'contrato' && (
        <div style={styles.card}>
          <CardHead title="SP_AGREGAR_CONTRATO_EMPRESA_DETALLE" sub="Crea un contrato entre tu empresa y un proveedor, con descuentos por producto." badge="Procedure" badgeColor="#10b981" />
          <div style={styles.infoNote}>
            <strong>Tu empresa</strong> quedará registrada como la empresa compradora del contrato automáticamente.
          </div>
          <div style={styles.triggerNote}>
            <strong>Validaciones activas:</strong> El SP valida que no exista un contrato activo duplicado, que los productos existan y que los porcentajes de descuento estén entre 0 y 100.
          </div>
          <div style={styles.form}>
            <Field label="Nombre del proveedor (razon_social)" value={contrato.nombre_proveedor} onChange={v => setContrato({ ...contrato, nombre_proveedor: v })} placeholder="Ej: Distribuidora XYZ S.A." />
            <Field label="Nombre de la regla de tarifa"        value={contrato.nombre_regla}     onChange={v => setContrato({ ...contrato, nombre_regla: v })}     placeholder="Ej: Descuento por volumen Q1" />
            <Field label="Vigente desde"  value={contrato.vigente_desde} onChange={v => setContrato({ ...contrato, vigente_desde: v })} placeholder="YYYY-MM-DDTHH:MM" />
            <Field label="Vigente hasta (vacío = sin límite)" value={contrato.vigente_hasta} onChange={v => setContrato({ ...contrato, vigente_hasta: v })} placeholder="YYYY-MM-DDTHH:MM" />
            <TextareaField label="Detalles (JSON)" hint='Array con sku y porcentaje_descuento. sku null = aplica a todos' value={contrato.detalles} onChange={v => setContrato({ ...contrato, detalles: v })} rows={6} />
          </div>
          <ExecBtn loading={loading} label="SP_AGREGAR_CONTRATO_EMPRESA_DETALLE" onClick={crearContrato} />
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

function CardHead({ title, sub, badge, badgeColor = '#1d4ed8' }) {
  return (
    <div style={styles.cardHead}>
      <div>
        <p style={styles.cardTitle}>{title}</p>
        <p style={styles.cardSub}>{sub}</p>
      </div>
      <span style={{ ...styles.procBadge, background: badgeColor + '22', color: badgeColor }}>{badge}</span>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      <input style={styles.input} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

function TextareaField({ label, hint, value, onChange, rows }) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      {hint && <p style={styles.hint}>{hint}</p>}
      <textarea style={styles.textarea} value={value} onChange={e => onChange(e.target.value)} rows={rows} />
    </div>
  )
}

function ExecBtn({ loading, label, onClick }) {
  return (
    <button style={styles.submitBtn} onClick={onClick} disabled={loading}>
      {loading ? 'Ejecutando...' : `▶ Ejecutar ${label}`}
    </button>
  )
}

const styles = {
  toast: { border: '1px solid', borderRadius: '10px', padding: '12px 16px', marginBottom: '1.25rem' },
  tabs:  { display: 'flex', gap: '8px', marginBottom: '1.25rem', flexWrap: 'wrap' },
  tab:   { padding: '9px 18px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '13.5px', fontWeight: '500', color: '#64748b' },
  tabActive: { background: '#1e293b', color: '#fff', border: '1px solid #1e293b' },
  card:  { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' },
  cardTitle: { margin: '0 0 4px', fontWeight: '700', fontSize: '15px', color: '#0f172a', fontFamily: 'monospace' },
  cardSub:   { margin: 0, fontSize: '13px', color: '#64748b' },
  procBadge: { padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', flexShrink: 0 },
  triggerNote: { background: '#fefce8', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#78350f', marginBottom: '1.25rem' },
  infoNote:    { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#1e3a8a', marginBottom: '1.25rem' },
  form:  { display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '5px' },
  hint:  { margin: '0 0 5px', fontSize: '12px', color: '#94a3b8' },
  input: { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#0f172a', boxSizing: 'border-box', outline: 'none', fontFamily: 'monospace' },
  textarea: { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12.5px', color: '#0f172a', boxSizing: 'border-box', outline: 'none', fontFamily: 'monospace', resize: 'vertical' },
  submitBtn: { background: '#1e293b', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', width: '100%' },
}
