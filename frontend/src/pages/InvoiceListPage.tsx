import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

interface Invoice {
  invoice_id: string;
  invoice_number: string;
  account: any;
  contact: any;
  invoice_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  currency_code: string;
}

const InvoiceListPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getInvoices({
        limit: 100,
        status: statusFilter || undefined
      });
      setInvoices(data.invoices || []);
    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      setError(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (invoiceId: string, invoiceNumber: string) => {
    if (!confirm(`Are you sure you want to delete invoice ${invoiceNumber}?`)) {
      return;
    }

    try {
      await api.deleteInvoice(invoiceId);
      setInvoices(invoices.filter((inv) => inv.invoice_id !== invoiceId));
    } catch (err: any) {
      alert('Failed to delete invoice: ' + err.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid':
        return 'bg-green-100 text-green-800';
      case 'Sent':
      case 'Viewed':
        return 'bg-blue-100 text-blue-800';
      case 'Partially Paid':
        return 'bg-yellow-100 text-yellow-800';
      case 'Overdue':
        return 'bg-red-100 text-red-800';
      case 'Draft':
        return 'bg-gray-100 text-gray-800';
      case 'Void':
      case 'Cancelled':
        return 'bg-gray-100 text-gray-500';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: currency || 'NZD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl text-gray-600">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600 mt-1">Manage your customer invoices</p>
        </div>
        <Link to="/invoices/new" className="btn btn-primary">
          New Invoice
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input"
        >
          <option value="">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Sent">Sent</option>
          <option value="Viewed">Viewed</option>
          <option value="Partially Paid">Partially Paid</option>
          <option value="Paid">Paid</option>
          <option value="Overdue">Overdue</option>
          <option value="Void">Void</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}

      {/* Invoice List */}
      {invoices.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No invoices found</p>
          <Link to="/invoices/new" className="btn btn-primary mt-4 inline-block">
            Create Your First Invoice
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th className="text-right">Total</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Due</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.invoice_id}>
                  <td>
                    <Link
                      to={`/invoices/${invoice.invoice_id}`}
                      className="text-primary-600 hover:text-primary-800 font-medium"
                    >
                      {invoice.invoice_number}
                    </Link>
                  </td>
                  <td>
                    {invoice.account?.data?.Name || 'N/A'}
                    {invoice.contact && (
                      <div className="text-sm text-gray-500">
                        {invoice.contact.data?.FirstName} {invoice.contact.data?.LastName}
                      </div>
                    )}
                  </td>
                  <td>{formatDate(invoice.invoice_date)}</td>
                  <td>{formatDate(invoice.due_date)}</td>
                  <td>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="text-right font-medium">
                    {formatCurrency(invoice.total_amount, invoice.currency_code)}
                  </td>
                  <td className="text-right">
                    {formatCurrency(invoice.amount_paid, invoice.currency_code)}
                  </td>
                  <td className="text-right font-medium">
                    {formatCurrency(invoice.amount_due, invoice.currency_code)}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <Link
                        to={`/invoices/${invoice.invoice_id}`}
                        className="text-sm text-primary-600 hover:text-primary-800"
                      >
                        View
                      </Link>
                      {invoice.status === 'Draft' && (
                        <button
                          onClick={() => handleDelete(invoice.invoice_id, invoice.invoice_number)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InvoiceListPage;
