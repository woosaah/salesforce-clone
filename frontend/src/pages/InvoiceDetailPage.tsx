import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';

interface LineItem {
  line_item_id?: string;
  line_number: number;
  product_id?: string;
  product_code?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
}

const InvoiceDetailPage: React.FC = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const isNew = invoiceId === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(isNew);

  // Accounts for dropdown
  const [accounts, setAccounts] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  // Invoice data
  const [invoiceData, setInvoiceData] = useState<any>({
    account_id: '',
    contact_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    payment_terms: 'Net 30',
    tax_rate: 15,
    discount_amount: 0,
    shipping_amount: 0,
    notes: '',
    terms_and_conditions: '',
    line_items: [] as LineItem[],
  });

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount_paid: 0,
    payment_method: 'Bank Transfer',
    reference_number: '',
    notes: '',
  });

  useEffect(() => {
    fetchAccounts();
    if (!isNew) {
      fetchInvoice();
      fetchPayments();
    }
  }, [invoiceId]);

  const fetchAccounts = async () => {
    try {
      const data = await api.getRecords('Account', { limit: 1000 });
      setAccounts(data.records || []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  };

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const data = await api.getInvoice(invoiceId!);
      setInvoiceData(data);
    } catch (err: any) {
      console.error('Error fetching invoice:', err);
      setError(err.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    try {
      const data = await api.getInvoicePayments(invoiceId!);
      setPayments(data || []);
    } catch (err) {
      console.error('Error fetching payments:', err);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!invoiceData.account_id || !invoiceData.invoice_date || !invoiceData.due_date) {
        setError('Please fill in all required fields');
        return;
      }

      if (invoiceData.line_items.length === 0) {
        setError('Please add at least one line item');
        return;
      }

      if (isNew) {
        const created = await api.createInvoice(invoiceData);
        navigate(`/invoices/${created.invoice_id}`);
      } else {
        await api.updateInvoice(invoiceId!, invoiceData);
        await fetchInvoice();
        setIsEditing(false);
      }
    } catch (err: any) {
      console.error('Error saving invoice:', err);
      setError(err.message || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  const addLineItem = () => {
    setInvoiceData({
      ...invoiceData,
      line_items: [
        ...invoiceData.line_items,
        {
          line_number: invoiceData.line_items.length + 1,
          description: '',
          quantity: 1,
          unit_price: 0,
          discount_percent: 0,
          discount_amount: 0,
          tax_amount: 0,
          line_total: 0,
        },
      ],
    });
  };

  const removeLineItem = (index: number) => {
    const newItems = invoiceData.line_items.filter((_: any, i: number) => i !== index);
    setInvoiceData({ ...invoiceData, line_items: newItems });
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const newItems = [...invoiceData.line_items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Calculate line total
    const item = newItems[index];
    item.line_total =
      item.quantity * item.unit_price - item.discount_amount + item.tax_amount;

    setInvoiceData({ ...invoiceData, line_items: newItems });
  };

  const calculateSubtotal = () => {
    return invoiceData.line_items.reduce(
      (sum: number, item: LineItem) => sum + item.quantity * item.unit_price,
      0
    );
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const taxAmount = (subtotal - invoiceData.discount_amount) * (invoiceData.tax_rate / 100);
    return subtotal - invoiceData.discount_amount + taxAmount + invoiceData.shipping_amount;
  };

  const handleRecordPayment = async () => {
    try {
      await api.recordPayment(invoiceId!, paymentData);
      setShowPaymentModal(false);
      await fetchInvoice();
      await fetchPayments();
      setPaymentData({
        payment_date: new Date().toISOString().split('T')[0],
        amount_paid: 0,
        payment_method: 'Bank Transfer',
        reference_number: '',
        notes: '',
      });
    } catch (err: any) {
      alert('Failed to record payment: ' + err.message);
    }
  };

  const handleVoidInvoice = async () => {
    if (!confirm('Are you sure you want to void this invoice?')) {
      return;
    }

    try {
      await api.voidInvoice(invoiceId!);
      await fetchInvoice();
    } catch (err: any) {
      alert('Failed to void invoice: ' + err.message);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl text-gray-600">Loading invoice...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link to="/invoices" className="text-primary-600 hover:text-primary-800 text-sm mb-2 inline-block">
            ← Back to Invoices
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            {isNew ? 'New Invoice' : invoiceData.invoice_number}
          </h1>
          {!isNew && (
            <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full mt-2 ${
              invoiceData.status === 'Paid' ? 'bg-green-100 text-green-800' :
              invoiceData.status === 'Overdue' ? 'bg-red-100 text-red-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {invoiceData.status}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {!isNew && !isEditing && invoiceData.status !== 'Void' && (
            <>
              {invoiceData.status !== 'Paid' && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="btn btn-primary"
                >
                  Record Payment
                </button>
              )}
              <button onClick={() => setIsEditing(true)} className="btn btn-secondary">
                Edit
              </button>
              {invoiceData.status === 'Draft' && (
                <button onClick={handleVoidInvoice} className="btn btn-secondary text-red-600">
                  Void
                </button>
              )}
            </>
          )}
          {(isNew || isEditing) && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? 'Saving...' : 'Save Invoice'}
              </button>
              {!isNew && (
                <button
                  onClick={() => {
                    setIsEditing(false);
                    fetchInvoice();
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}

      {/* Invoice Details */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Invoice Details</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Customer Account *</label>
              {isEditing ? (
                <select
                  value={invoiceData.account_id}
                  onChange={(e) => setInvoiceData({ ...invoiceData, account_id: e.target.value })}
                  className="input"
                >
                  <option value="">Select Account</option>
                  {accounts.map((acc) => (
                    <option key={acc.record_id} value={acc.record_id}>
                      {acc.data.Name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-gray-900">{invoiceData.account?.data?.Name || 'N/A'}</div>
              )}
            </div>

            <div>
              <label className="label">Invoice Date *</label>
              {isEditing ? (
                <input
                  type="date"
                  value={invoiceData.invoice_date}
                  onChange={(e) => setInvoiceData({ ...invoiceData, invoice_date: e.target.value })}
                  className="input"
                />
              ) : (
                <div className="text-gray-900">{new Date(invoiceData.invoice_date).toLocaleDateString()}</div>
              )}
            </div>

            <div>
              <label className="label">Due Date *</label>
              {isEditing ? (
                <input
                  type="date"
                  value={invoiceData.due_date}
                  onChange={(e) => setInvoiceData({ ...invoiceData, due_date: e.target.value })}
                  className="input"
                />
              ) : (
                <div className="text-gray-900">{new Date(invoiceData.due_date).toLocaleDateString()}</div>
              )}
            </div>

            <div>
              <label className="label">Payment Terms</label>
              {isEditing ? (
                <select
                  value={invoiceData.payment_terms}
                  onChange={(e) => setInvoiceData({ ...invoiceData, payment_terms: e.target.value })}
                  className="input"
                >
                  <option value="Due on Receipt">Due on Receipt</option>
                  <option value="Net 15">Net 15</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 60">Net 60</option>
                  <option value="Net 90">Net 90</option>
                </select>
              ) : (
                <div className="text-gray-900">{invoiceData.payment_terms}</div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">Amounts</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Tax Rate (%)</label>
              {isEditing ? (
                <input
                  type="number"
                  value={invoiceData.tax_rate}
                  onChange={(e) => setInvoiceData({ ...invoiceData, tax_rate: parseFloat(e.target.value) })}
                  className="input"
                  step="0.01"
                />
              ) : (
                <div className="text-gray-900">{invoiceData.tax_rate}%</div>
              )}
            </div>

            <div>
              <label className="label">Discount Amount</label>
              {isEditing ? (
                <input
                  type="number"
                  value={invoiceData.discount_amount}
                  onChange={(e) => setInvoiceData({ ...invoiceData, discount_amount: parseFloat(e.target.value) })}
                  className="input"
                  step="0.01"
                />
              ) : (
                <div className="text-gray-900">{formatCurrency(invoiceData.discount_amount)}</div>
              )}
            </div>

            <div>
              <label className="label">Shipping Amount</label>
              {isEditing ? (
                <input
                  type="number"
                  value={invoiceData.shipping_amount}
                  onChange={(e) => setInvoiceData({ ...invoiceData, shipping_amount: parseFloat(e.target.value) })}
                  className="input"
                  step="0.01"
                />
              ) : (
                <div className="text-gray-900">{formatCurrency(invoiceData.shipping_amount)}</div>
              )}
            </div>

            {!isNew && (
              <div className="pt-4 border-t">
                <div className="flex justify-between mb-2">
                  <span className="font-medium">Total:</span>
                  <span className="font-bold text-lg">{formatCurrency(invoiceData.total_amount)}</span>
                </div>
                <div className="flex justify-between mb-2 text-green-600">
                  <span>Paid:</span>
                  <span>{formatCurrency(invoiceData.amount_paid)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Due:</span>
                  <span className="font-bold">{formatCurrency(invoiceData.amount_due)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="card mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Line Items</h2>
          {isEditing && (
            <button onClick={addLineItem} className="btn btn-secondary">
              Add Line Item
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Discount</th>
                <th className="text-right">Total</th>
                {isEditing && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {invoiceData.line_items.map((item: LineItem, index: number) => (
                <tr key={index}>
                  <td>
                    {isEditing ? (
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                        className="input"
                        placeholder="Item description"
                      />
                    ) : (
                      item.description
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value))}
                        className="input text-right"
                        step="0.01"
                      />
                    ) : (
                      <div className="text-right">{item.quantity}</div>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value))}
                        className="input text-right"
                        step="0.01"
                      />
                    ) : (
                      <div className="text-right">{formatCurrency(item.unit_price)}</div>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        value={item.discount_amount}
                        onChange={(e) => updateLineItem(index, 'discount_amount', parseFloat(e.target.value))}
                        className="input text-right"
                        step="0.01"
                      />
                    ) : (
                      <div className="text-right">{formatCurrency(item.discount_amount)}</div>
                    )}
                  </td>
                  <td className="text-right font-medium">{formatCurrency(item.line_total)}</td>
                  {isEditing && (
                    <td>
                      <button
                        onClick={() => removeLineItem(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="text-right font-bold">Subtotal:</td>
                <td className="text-right font-bold">{formatCurrency(calculateSubtotal())}</td>
                {isEditing && <td></td>}
              </tr>
              <tr>
                <td colSpan={4} className="text-right">Tax ({invoiceData.tax_rate}%):</td>
                <td className="text-right">{formatCurrency((calculateSubtotal() - invoiceData.discount_amount) * (invoiceData.tax_rate / 100))}</td>
                {isEditing && <td></td>}
              </tr>
              <tr>
                <td colSpan={4} className="text-right">Discount:</td>
                <td className="text-right">-{formatCurrency(invoiceData.discount_amount)}</td>
                {isEditing && <td></td>}
              </tr>
              <tr>
                <td colSpan={4} className="text-right">Shipping:</td>
                <td className="text-right">{formatCurrency(invoiceData.shipping_amount)}</td>
                {isEditing && <td></td>}
              </tr>
              <tr>
                <td colSpan={4} className="text-right font-bold text-lg">Total:</td>
                <td className="text-right font-bold text-lg">{formatCurrency(calculateTotal())}</td>
                {isEditing && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Notes */}
      {(isEditing || invoiceData.notes) && (
        <div className="card mb-6">
          <h2 className="text-xl font-bold mb-4">Notes</h2>
          {isEditing ? (
            <textarea
              value={invoiceData.notes}
              onChange={(e) => setInvoiceData({ ...invoiceData, notes: e.target.value })}
              className="input"
              rows={4}
              placeholder="Internal notes..."
            />
          ) : (
            <p className="text-gray-900 whitespace-pre-wrap">{invoiceData.notes}</p>
          )}
        </div>
      )}

      {/* Payment History */}
      {!isNew && payments.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Payment History</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Processed By</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment: any) => (
                <tr key={payment.payment_id}>
                  <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                  <td className="font-medium">{formatCurrency(payment.amount_paid)}</td>
                  <td>{payment.payment_method}</td>
                  <td>{payment.reference_number || '-'}</td>
                  <td>{payment.first_name} {payment.last_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Record Payment</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Payment Date *</label>
                <input
                  type="date"
                  value={paymentData.payment_date}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Amount *</label>
                <input
                  type="number"
                  value={paymentData.amount_paid}
                  onChange={(e) => setPaymentData({ ...paymentData, amount_paid: parseFloat(e.target.value) })}
                  className="input"
                  step="0.01"
                  max={invoiceData.amount_due}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Amount due: {formatCurrency(invoiceData.amount_due)}
                </p>
              </div>
              <div>
                <label className="label">Payment Method *</label>
                <select
                  value={paymentData.payment_method}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                  className="input"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Cash">Cash</option>
                  <option value="Check">Check</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Reference Number</label>
                <input
                  type="text"
                  value={paymentData.reference_number}
                  onChange={(e) => setPaymentData({ ...paymentData, reference_number: e.target.value })}
                  className="input"
                  placeholder="Transaction ID, check number, etc."
                />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  className="input"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                className="btn btn-primary"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceDetailPage;
