import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { ObjectMeta } from '../../types';

const Layout: React.FC = () => {
  const { user, tenant, logout } = useAuth();
  const location = useLocation();
  const [objects, setObjects] = useState<ObjectMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchObjects = async () => {
      try {
        const data = await api.getObjects();
        setObjects(data);
      } catch (error) {
        console.error('Failed to fetch objects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchObjects();
  }, []);

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center px-6">
        <div className="flex items-center flex-1">
          <Link to="/" className="text-2xl font-bold text-primary-600">
            Salesforce Clone
          </Link>
          <div className="ml-8 text-sm text-gray-600">
            {tenant?.tenant_name}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-700">
            {user?.first_name} {user?.last_name}
          </div>
          <button
            onClick={logout}
            className="btn btn-secondary text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-100 border-r border-gray-200 p-4">
          <nav className="space-y-1">
            <Link
              to="/"
              className={`block px-4 py-2 rounded-md text-sm font-medium ${
                location.pathname === '/'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              Home
            </Link>

            <Link
              to="/query"
              className={`block px-4 py-2 rounded-md text-sm font-medium ${
                location.pathname === '/query'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              Query Console
            </Link>

            <Link
              to="/invoices"
              className={`block px-4 py-2 rounded-md text-sm font-medium ${
                isActive('/invoices')
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              Invoices
            </Link>

            <div className="pt-4 pb-2">
              <div className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Objects
              </div>
            </div>

            {loading ? (
              <div className="px-4 py-2 text-sm text-gray-500">Loading...</div>
            ) : (
              objects.map((obj) => (
                <Link
                  key={obj.object_id}
                  to={`/objects/${obj.object_name}`}
                  className={`block px-4 py-2 rounded-md text-sm font-medium ${
                    isActive(`/objects/${obj.object_name}`)
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {obj.plural_label}
                </Link>
              ))
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
