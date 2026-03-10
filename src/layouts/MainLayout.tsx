import { Outlet } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar'
import Header from '../components/layout/Header'

const MainLayout = () => {
    return (
        <div className="min-h-screen bg-hud-bg-primary hud-grid-bg">
            {/* Sidebar */}
            <Sidebar
                collapsed={false}
                onToggle={() => {}}
            />

            {/* Main Content */}
            <div className="transition-all duration-300 ml-60">
                {/* Header */}
                <Header onMenuToggle={() => {}} showMenuToggle={false} />

                {/* Page Content */}
                <main className="p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}

export default MainLayout
