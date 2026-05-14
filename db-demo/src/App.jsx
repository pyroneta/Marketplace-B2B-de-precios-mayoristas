import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'

import Login from './Pages/Login'
import Registro from './Pages/RegistroEmpresa'

import Layout from './components/Layout'
import Dashboard from './Pages/Dashboard'
import MisOrdenes from './Pages/MisOrdenes'
import Procedures from './Pages/Procedures'
import VistaPage from './Pages/VistaPage'
import Facturas from './Pages/Facturas'
import Contratos from './Pages/Contratos'
import TarifasProducto from './Pages/TarifasProducto'
import ReglasTarifa from './Pages/ReglasTarifa'
import Productos from './Pages/Productos'

function ProtectedRoutes() {
  const { session } = useAuth()

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/mis-ordenes" element={<MisOrdenes />} />
        <Route path="/procedures" element={<Procedures />} />


        <Route path="/contratos" element={<Contratos />} />
        <Route path="/facturas" element={<Facturas />} />
        <Route path="/tarifas-producto" element={<TarifasProducto />} />

        <Route path="/productos" element={<Productos />} />

        {/* Vistas proveedor */}
        <Route path="/stock" element={<VistaPage tipo="stock" />} />
        <Route path="/comisiones" element={<VistaPage tipo="comisiones" />} />
        <Route path="/contratos" element={<VistaPage tipo="contratos" />} />
        <Route path="/reglas-tarifa" element={<ReglasTarifa />} />

        {/* Vistas empresa compradora */}
        <Route path="/facturas" element={<VistaPage tipo="facturas" />} />
        <Route path="/productos" element={<VistaPage tipo="productos" />} />
        <Route path="/resumen" element={<VistaPage tipo="resumen" />} />
        <Route path="/proveedores" element={<VistaPage tipo="proveedores" />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  )
}

function AppRoutes() {
  const { session } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate to="/dashboard" replace /> : <Login />}
      />

      <Route
        path="/registro"
        element={session ? <Navigate to="/dashboard" replace /> : <Registro />}
      />

      <Route path="/tarifas-producto" element={<TarifasProducto />} />

      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}