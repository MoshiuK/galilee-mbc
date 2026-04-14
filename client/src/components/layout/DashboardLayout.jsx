import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import {
  LayoutDashboard, Phone, PhoneCall, Hash, ListTree, Users, Clock,
  Voicemail, BookUser, Palette, Settings, LogOut, Menu, X, ChevronDown,
  Building2, PhoneForwarded, Layers, Bell, BarChart3, Smartphone
} from 'lucide-react';

const tenantNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/extensions', icon: Hash, label: 'Extensions' },
  { to: '/phone-numbers', icon: Phone, label: 'Phone Numbers' },
  { to: '/provisioning', icon: Smartphone, label: 'Phone Provisioning' },
  { to: '/ivr', icon: ListTree, label: 'IVR Menus' },
  { to: '/ring-groups', icon: PhoneForwarded, label: 'Ring Groups' },
  { to: '/call-queues', icon: Layers, label: 'Call Queues' },
  { to: '/time-conditions', icon: Clock, label: 'Time Conditions' },
  { to: '/call-logs', icon: PhoneCall, label: 'Call Logs' },
  { to: '/voicemail', icon: Voicemail, label: 'Voicemail' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/usage-stats', icon: BarChart3, label: 'Usage Stats' },
  { to: '/contacts', icon: BookUser, label: 'Contacts' },
  { to: '/branding', icon: Palette, label: 'Branding' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const platformNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/tenants', icon: Building2, label: 'Tenants' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isPlatform = user?.scope === 'platform';
  const nav = isPlatform ? platformNav : tenantNav;

  // Apply branding colors
  useEffect(() => {
    if (user?.tenant?.brandPrimaryColor) {
      document.documentElement.style.setProperty('--brand-primary', user.tenant.brandPrimaryColor);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const brandName = user?.tenant?.brandName || user?.tenantName || 'PBX Admin';

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white transform transition-transform duration-200
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Phone className="w-6 h-6 text-blue-400" />
            <span className="font-bold text-lg truncate">{brandName}</span>
          </div>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {nav.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-gray-800 text-white border-r-2 border-blue-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium">
              {(user?.firstName?.[0] || user?.name?.[0] || user?.email?.[0] || '?').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.firstName ? `${user.firstName} ${user.lastName}` : user?.name || user?.email}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-6 shrink-0">
          <button className="lg:hidden mr-3" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <div className="text-sm text-gray-500">
            {isPlatform ? 'Platform Admin' : user?.tenantName || ''}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
