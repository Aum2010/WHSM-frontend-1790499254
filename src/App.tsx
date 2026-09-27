import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth.store'
import Layout         from './components/layout/Layout'
import LoginPage      from './pages/auth/LoginPage'
import DashboardPage  from './pages/dashboard/DashboardPage'
import InventoryPage  from './pages/inventory/InventoryPage'
import ProductionPage from './pages/production/ProductionPage'
import OrderPage      from './pages/order/OrderPage'
import QaPage         from './pages/qa/QaPage'
import PurchasePage   from './pages/purchase/PurchasePage'
import RecipePage from './pages/recipe/RecipePage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"  element={<DashboardPage />} />
        <Route path="inventory"  element={<InventoryPage />} />
        <Route path="recipe" element={<RecipePage />} />
        <Route path="production" element={<ProductionPage />} />
        <Route path="order"      element={<OrderPage />} />
        <Route path="qa"         element={<QaPage />} />
        <Route path="purchase"   element={<PurchasePage />} />
      </Route>
    </Routes>
  )
}