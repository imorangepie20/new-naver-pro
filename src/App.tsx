import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import { useThemeStore } from './stores/themeStore'

// Dashboard
import Dashboard from './pages/dashboard/Dashboard'
import Analytics from './pages/dashboard/Analytics'

// Email
import EmailInbox from './pages/email/EmailInbox'
import EmailCompose from './pages/email/EmailCompose'
import EmailDetail from './pages/email/EmailDetail'

// Core Pages
import Widgets from './pages/Widgets'
import Profile from './pages/Profile'
import Calendar from './pages/Calendar'
import Settings from './pages/Settings'
import ScrumBoard from './pages/ScrumBoard'
import Products from './pages/Products'
import Pricing from './pages/Pricing'
import Gallery from './pages/Gallery'

// Auth
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

// AI Studio
import AiChat from './pages/ai/AiChat'
import AiImageGenerator from './pages/ai/AiImageGenerator'

// POS System
import PosCustomerOrder from './pages/pos/PosCustomerOrder'
import PosKitchenOrder from './pages/pos/PosKitchenOrder'
import PosCounterCheckout from './pages/pos/PosCounterCheckout'
import PosTableBooking from './pages/pos/PosTableBooking'
import PosMenuStock from './pages/pos/PosMenuStock'

// UI Components
import UiBootstrap from './pages/ui/UiBootstrap'
import UiButtons from './pages/ui/UiButtons'
import UiCard from './pages/ui/UiCard'
import UiIcons from './pages/ui/UiIcons'
import UiModalNotification from './pages/ui/UiModalNotification'
import UiTypography from './pages/ui/UiTypography'
import UiTabsAccordions from './pages/ui/UiTabsAccordions'

// Forms
import FormElements from './pages/forms/FormElements'
import FormPlugins from './pages/forms/FormPlugins'
import FormWizards from './pages/forms/FormWizards'

// Tables
import TableElements from './pages/tables/TableElements'
import TablePlugins from './pages/tables/TablePlugins'

// Charts
import ChartJs from './pages/charts/ChartJs'

// Real Estate
import RealEstate from './pages/real-estate/RealEstate'
import TempPropertyList from './pages/real-estate/TempPropertyList'
import ComplexListPage from './pages/real-estate/ComplexListPage'
import ApartmentTempPropertyList from './pages/real-estate/ApartmentTempPropertyList'
import ApartmentRegularPropertyList from './pages/real-estate/ApartmentRegularPropertyList'
import UploadedPropertyList from './pages/real-estate/UploadedPropertyList'
import PropertyRegister from './pages/real-estate/PropertyRegister'
import FavoritePropertyList from './pages/real-estate/FavoritePropertyList'
import ManagedPropertyList from './pages/real-estate/ManagedPropertyList'
import AddressMarketStats from './pages/real-estate/AddressMarketStats'
import RebMarketStats from './pages/real-estate/RebMarketStats'

// Misc Pages
import Error404 from './pages/Error404'
import ComingSoon from './pages/ComingSoon'

// Auth
import PrivateRoute from './components/auth/PrivateRoute'

function App() {
    const { loadFromServer } = useThemeStore()

    // 앱 시작 시 서버에서 글로벌 테마 로드
    useEffect(() => {
        loadFromServer()
    }, [])

    return (
        <Router>
            <Routes>
                {/* Auth Pages (No Layout) */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/coming-soon" element={<ComingSoon />} />
                <Route path="/404" element={<Error404 />} />

                {/* Main Layout Pages - 로그인 필수 */}
                <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
                    <Route index element={<Dashboard />} />
                    <Route path="analytics" element={<Analytics />} />

                    {/* Email */}
                    <Route path="email/inbox" element={<EmailInbox />} />
                    <Route path="email/compose" element={<EmailCompose />} />
                    <Route path="email/detail/:id" element={<EmailDetail />} />

                    {/* Core Pages */}
                    <Route path="widgets" element={<Widgets />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="calendar" element={<Calendar />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="scrum-board" element={<ScrumBoard />} />
                    <Route path="products" element={<Products />} />
                    <Route path="pricing" element={<Pricing />} />
                    <Route path="gallery" element={<Gallery />} />

                    {/* AI Studio */}
                    <Route path="ai/chat" element={<AiChat />} />
                    <Route path="ai/image-generator" element={<AiImageGenerator />} />

                    {/* POS System */}
                    <Route path="pos/customer-order" element={<PosCustomerOrder />} />
                    <Route path="pos/kitchen-order" element={<PosKitchenOrder />} />
                    <Route path="pos/counter-checkout" element={<PosCounterCheckout />} />
                    <Route path="pos/table-booking" element={<PosTableBooking />} />
                    <Route path="pos/menu-stock" element={<PosMenuStock />} />

                    {/* UI Components */}
                    <Route path="ui/bootstrap" element={<UiBootstrap />} />
                    <Route path="ui/buttons" element={<UiButtons />} />
                    <Route path="ui/card" element={<UiCard />} />
                    <Route path="ui/icons" element={<UiIcons />} />
                    <Route path="ui/modal-notification" element={<UiModalNotification />} />
                    <Route path="ui/typography" element={<UiTypography />} />
                    <Route path="ui/tabs-accordions" element={<UiTabsAccordions />} />

                    {/* Forms */}
                    <Route path="form/elements" element={<FormElements />} />
                    <Route path="form/plugins" element={<FormPlugins />} />
                    <Route path="form/wizards" element={<FormWizards />} />

                    {/* Tables */}
                    <Route path="table/elements" element={<TableElements />} />
                    <Route path="table/plugins" element={<TablePlugins />} />

                    {/* Charts */}
                    <Route path="chart/chartjs" element={<ChartJs />} />

                    {/* Real Estate */}
                    <Route path="real-estate" element={<RealEstate />} />
                    <Route path="real-estate/temp-properties" element={<TempPropertyList />} />
                    <Route path="real-estate/apartments" element={<ComplexListPage propertyType="APT" />} />
                    <Route path="real-estate/officetels" element={<ComplexListPage propertyType="OPST" />} />
                    <Route path="real-estate/apartment-temp-properties" element={<ApartmentTempPropertyList />} />
                    <Route path="real-estate/regular-properties" element={<ApartmentRegularPropertyList />} />
                    <Route path="real-estate/uploaded-properties" element={<UploadedPropertyList />} />
                    <Route path="real-estate/register" element={<PropertyRegister />} />
                    <Route path="real-estate/favorites" element={<FavoritePropertyList />} />
                    <Route path="real-estate/managed" element={<ManagedPropertyList />} />
                    <Route path="real-estate/address-market-stats" element={<AddressMarketStats />} />
                    <Route path="real-estate/reb-market-stats" element={<RebMarketStats />} />
                </Route>

                {/* 404 Fallback */}
                <Route path="*" element={<Error404 />} />
            </Routes>
        </Router>
    )
}

export default App
