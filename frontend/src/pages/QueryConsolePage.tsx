import React, { useState } from 'react';
import { api } from '../services/api';

interface QueryResult {
  records: any[];
  rowCount: number;
  executionTime: number;
  objectName: string;
}

const QueryConsolePage: React.FC = () => {
  const [query, setQuery] = useState('SELECT Name, Status FROM Account LIMIT 10');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Sample queries for quick access
  const sampleQueries = [
    {
      label: 'All Accounts',
      query: 'SELECT Name, Industry, Status FROM Account',
    },
    {
      label: 'Contacts with Account',
      query: 'SELECT Name, Email, Account.Name FROM Contact',
    },
    {
      label: 'Active Products',
      query: "SELECT Name, Price, ProductCode FROM Product WHERE Status = 'active'",
    },
    {
      label: 'Recent Cases',
      query: 'SELECT Subject, Priority, Status FROM Case ORDER BY CreatedDate DESC LIMIT 20',
    },
    {
      label: 'High Priority Cases',
      query: "SELECT Subject, Account.Name, Contact.Name FROM Case WHERE Priority = 'high'",
    },
  ];

  const handleExecute = async () => {
    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await api.executeQuery(query);
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Query execution failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSampleQuery = (sampleQuery: string) => {
    setQuery(sampleQuery);
    setResult(null);
    setError('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter to execute
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Query Console</h1>
      <p className="text-gray-600 mb-6">
        Execute SOQL queries against your data
      </p>

      {/* Sample Queries */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Quick Start Queries:
        </label>
        <div className="flex flex-wrap gap-2">
          {sampleQueries.map((sample, index) => (
            <button
              key={index}
              onClick={() => handleSampleQuery(sample.query)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {/* Query Editor */}
      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          SOQL Query:
        </label>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="input font-mono text-sm"
          rows={6}
          placeholder="SELECT Name, Status FROM Account WHERE Status = 'active' LIMIT 10"
        />
        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            Press <kbd className="px-2 py-1 bg-gray-100 rounded">Ctrl + Enter</kbd> to execute
          </div>
          <button
            onClick={handleExecute}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Executing...' : 'Execute Query'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="text-sm text-red-800">
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="card">
          <div className="mb-4 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Query Results</h2>
              <p className="text-sm text-gray-600">
                {result.rowCount} row{result.rowCount !== 1 ? 's' : ''} •{' '}
                {result.executionTime}ms
              </p>
            </div>
          </div>

          {result.records.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No records found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    {Object.keys(result.records[0])
                      .filter((key) => key !== 'record_id')
                      .map((key) => (
                        <th
                          key={key}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {key}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {result.records.map((record, index) => (
                    <tr key={record.record_id || index} className="hover:bg-gray-50">
                      {Object.entries(record)
                        .filter(([key]) => key !== 'record_id')
                        .map(([key, value]) => (
                          <td key={key} className="table-cell">
                            {value === null || value === undefined
                              ? '-'
                              : typeof value === 'boolean'
                              ? value
                                ? '✓'
                                : ''
                              : String(value)}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SOQL Reference */}
      <div className="mt-8 card bg-blue-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">SOQL Reference</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <div>
            <strong>Basic Query:</strong>
            <code className="block mt-1 p-2 bg-white rounded text-xs">
              SELECT Name, Status FROM Account
            </code>
          </div>
          <div>
            <strong>With WHERE:</strong>
            <code className="block mt-1 p-2 bg-white rounded text-xs">
              SELECT Name FROM Account WHERE Status = 'active' AND Industry = 'technology'
            </code>
          </div>
          <div>
            <strong>Relationship Query:</strong>
            <code className="block mt-1 p-2 bg-white rounded text-xs">
              SELECT Name, Email, Account.Name FROM Contact
            </code>
          </div>
          <div>
            <strong>With ORDER BY and LIMIT:</strong>
            <code className="block mt-1 p-2 bg-white rounded text-xs">
              SELECT Name, Priority FROM Case ORDER BY Priority DESC LIMIT 10
            </code>
          </div>
          <div>
            <strong>Supported Operators:</strong>
            <span className="ml-2 font-mono text-xs">
              = != &lt; &gt; &lt;= &gt;= LIKE IN NOT IN AND OR
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueryConsolePage;
