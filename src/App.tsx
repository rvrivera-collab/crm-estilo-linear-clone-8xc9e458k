import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import Ask from '@/pages/Ask'
import ConfirmEmailChange from '@/pages/ConfirmEmailChange'
import Campaigns from '@/pages/Campaigns'
import CaptureForms from '@/pages/CaptureForms'
import Contacts from '@/pages/Contacts'
import CustomerJourney from '@/pages/CustomerJourney'
import Deals from '@/pages/Deals'
import Indicacoes from '@/pages/Indicacoes'
import Orders from '@/pages/Orders'
import Reminders from '@/pages/Reminders'
import Empresas from '@/pages/Empresas'
import ForgotPassword from '@/pages/ForgotPassword'
import Index from '@/pages/Index'
import LeadCapture from '@/pages/LeadCapture'
import Login from '@/pages/Login'
import Messages from '@/pages/Messages'
import NotFound from '@/pages/NotFound'
import Pipeline from '@/pages/Pipeline'
import Recovery from '@/pages/Recovery'
import ResetPassword from '@/pages/ResetPassword'
import Settings from '@/pages/Settings'
import Signup from '@/pages/Signup'
import VerifyEmail from '@/pages/VerifyEmail'

export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/captura" element={<LeadCapture />} />
            <Route path="/form/:id" element={<LeadCapture />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/ask" replace />} />
                <Route path="ask" element={<Ask />} />
                <Route path="dashboard" element={<Index />} />
                <Route path="jornada" element={<CustomerJourney />} />
                <Route path="pedidos" element={<Orders />} />
                <Route path="indicacoes" element={<Indicacoes />} />
                <Route path="lembretes" element={<Reminders />} />
                <Route path="pipeline" element={<Pipeline />} />
                <Route path="recuperacao" element={<Recovery />} />
                <Route path="negocios" element={<Deals />} />
                <Route path="contatos" element={<Contacts />} />
                <Route path="empresas" element={<Empresas />} />
                <Route path="campanhas" element={<Campaigns />} />
                <Route path="formularios" element={<CaptureForms />} />
                <Route path="embed" element={<Navigate to="/formularios" replace />} />
                <Route path="mensagens" element={<Messages />} />
                <Route path="configuracoes" element={<Settings />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </TooltipProvider>
    </BrowserRouter>
  )
}
