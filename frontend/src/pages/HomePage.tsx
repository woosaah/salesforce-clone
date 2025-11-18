import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { ObjectMeta } from '../types';

const HomePage: React.FC = () => {
  const { user, tenant } = useAuth();
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

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        Welcome back, {user?.first_name}!
      </h1>
      <p className="text-gray-600 mb-8">
        {tenant?.tenant_name}
      </p>

      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Standard Objects
        </h2>

        {loading ? (
          <div className="text-gray-500">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {objects.map((obj) => (
              <Link
                key={obj.object_id}
                to={`/objects/${obj.object_name}`}
                className="block p-6 border border-gray-200 rounded-lg hover:border-primary-500 hover:shadow-md transition-all"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {obj.plural_label}
                </h3>
                <p className="text-sm text-gray-600">
                  {obj.description || `Manage ${obj.plural_label.toLowerCase()}`}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Quick Stats
          </h3>
          <p className="text-3xl font-bold text-primary-600">
            {objects.length}
          </p>
          <p className="text-sm text-gray-600">Active Objects</p>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Subscription
          </h3>
          <p className="text-xl font-semibold text-gray-900 capitalize">
            {tenant?.subscription_tier}
          </p>
          <p className="text-sm text-gray-600">Current Plan</p>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Profile
          </h3>
          <p className="text-sm text-gray-600">
            {user?.email}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            User ID: {user?.user_id.slice(0, 8)}...
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
