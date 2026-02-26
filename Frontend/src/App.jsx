import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import './App.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const defaultCategories = [
  'Salary', 'Food', 'Rent', 'Utilities', 'Entertainment',
  'Travel', 'Health', 'Shopping', 'Education', 'Miscellaneous'
];

// ✅ Replace with your deployed backend URL
// Replace old local URL
const API_URL = 'https://backend-personalfinancetracker.onrender.com';

function App() {
  const [transactions, setTransactions] = useState([]);
  const pieRef = useRef(null);
  const [newTransaction, setNewTransaction] = useState({
    date: '', payee: '', category: '', amount: '',
  });
  const [errors, setErrors] = useState({});
  const [editTransactionId, setEditTransactionId] = useState(null);

  const [filterCategory, setFilterCategory] = useState('All');
  const [filterPayee, setFilterPayee] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [showCharts, setShowCharts] = useState(false);

  useEffect(() => { fetchTransactions(); }, []);

  const fetchTransactions = () => {
    axios.get(`${API_URL}/api/transactions`)
      .then(res => {
        const normalized = res.data.map(txn => ({
          ...txn,
          date: txn.date?.slice(0, 10),
        }));
        setTransactions(normalized);
      })
      .catch(err => console.error('Error fetching transactions:', err));
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setNewTransaction({ ...newTransaction, [name]: value });
    setErrors({ ...errors, [name]: '' });
  };

  const calculateBalance = () =>
    transactions.reduce((acc, txn) => acc + (parseFloat(txn.amount) || 0), 0);

  const resetForm = (action) => {
    setNewTransaction({ date: '', payee: '', category: '', amount: '' });
    setErrors({});
    setEditTransactionId(null);
    if (action === 'cancel') toast.info('Transaction edit cancelled');
    if (action === 'update') toast.success('Transaction updated successfully');
    if (action === 'add') toast.success('Transaction added successfully');
  };

  const handleAddOrUpdate = (e) => {
    e.preventDefault();
    const { date, payee, category, amount } = newTransaction;
    const newErrors = {};
    if (!date) newErrors.date = 'Date is required';
    if (!payee.trim()) newErrors.payee = 'Payee is required';
    if (!category.trim()) newErrors.category = 'Category is required';
    if (!amount.trim()) newErrors.amount = 'Amount is required';
    else if (isNaN(parseFloat(amount))) newErrors.amount = 'Amount must be a number';
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

    const parsedAmount = parseFloat(amount);
    const request = editTransactionId
      ? axios.put(`${API_URL}/api/transactions/${editTransactionId}`, { date, payee, category, amount: parsedAmount })
      : axios.post(`${API_URL}/api/transactions`, { date, payee, category, amount: parsedAmount });

    request
      .then(res => {
        const txnRaw = res.data?.data;
        if (!txnRaw) return toast.error('Transaction not returned by server');
        const txn = { ...txnRaw, date: txnRaw.date ? txnRaw.date.slice(0, 10) : '' };
        if (editTransactionId) {
          setTransactions(transactions.map(t => t._id === editTransactionId ? txn : t));
          resetForm('update');
        } else {
          setTransactions(prev => [txn, ...prev]);
          resetForm('add');
        }
      })
      .catch(err => { console.error(err); toast.error('Something went wrong!'); });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    try {
      const res = await axios.delete(`${API_URL}/api/transactions/${id}`);
      setTransactions(transactions.filter(txn => txn._id !== id));
      toast.success(res.data.message || 'Transaction deleted successfully');
    } catch (err) { console.error(err); toast.error('Failed to delete transaction'); }
  };

  const handleEdit = (txn) => {
    setEditTransactionId(txn._id);
    setNewTransaction({
      date: txn.date || '',
      payee: txn.payee || '',
      category: txn.category || '',
      amount: txn.amount?.toString() || '',
    });
  };

  const filteredTransactions = transactions.filter(txn => {
    if (!txn) return false;
    if (filterCategory !== 'All' && txn.category !== filterCategory) return false;
    if (filterPayee && !txn.payee?.toLowerCase().includes(filterPayee.toLowerCase())) return false;
    const txnDate = new Date(txn.date).setHours(0,0,0,0);
    const fromDate = filterDateFrom ? new Date(filterDateFrom).setHours(0,0,0,0) : null;
    const toDate = filterDateTo ? new Date(filterDateTo).setHours(0,0,0,0) : null;
    if (fromDate && txnDate < fromDate) return false;
    if (toDate && txnDate > toDate) return false;
    return true;
  });

  const downloadCSV = () => {
    if (!filteredTransactions.length) {
      toast.info('No transactions to download');
      return;
    }

    const headers = ['Date', 'Payee', 'Category', 'Amount'];
    const rows = filteredTransactions.map(txn => [txn.date, txn.payee, txn.category, txn.amount]);
    const csvContent = headers.join(',') + '\n' + rows.map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'transactions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const uniqueCategories = ['All', ...new Set(transactions.filter(txn => txn?.category).map(txn => txn.category))];

  // ====== Charts Data ======
  const pieData = useMemo(() => ({
    labels: defaultCategories,
    datasets: [{
      data: defaultCategories.map(cat =>
        transactions
          .filter(txn => txn.category === cat)
          .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0)
      ),
      backgroundColor: [
        '#4e54c8', '#8f94fb', '#f39c12', '#27ae60', '#e74c3c',
        '#9b59b6', '#1abc9c', '#f1c40f', '#34495e', '#d35400'
      ],
      borderWidth: 1,
    }],
  }), [transactions]);

  useEffect(() => {
    if (pieRef.current) {
      pieRef.current.update();
    }
  }, [pieData]);

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: true },
    plugins: {
      tooltip: {
        enabled: true,
        callbacks: {
          label: function (context) {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const value = context.raw || 0;
            const percentage = total ? ((value / total) * 100).toFixed(1) : 0;
            return `${context.label}: ₹${value} (${percentage}%)`;
          },
        },
      },
      legend: { position: 'bottom' },
    },
  };

  const barData = useMemo(() => {
    const monthlyData = {};
    transactions.forEach(txn => {
      if (!txn.date) return;
      const month = new Date(txn.date).toLocaleString('default', { month: 'short', year: 'numeric' });
      if (!monthlyData[month]) monthlyData[month] = { income: 0, expense: 0 };
      const amount = parseFloat(txn.amount) || 0;
      if (txn.category === 'Salary') monthlyData[month].income += amount;
      else monthlyData[month].expense += Math.abs(amount);
    });
    const labels = Object.keys(monthlyData);
    return {
      labels,
      datasets: [
        { label: 'Income', data: labels.map(m => monthlyData[m].income), backgroundColor: '#27ae60' },
        { label: 'Expense', data: labels.map(m => monthlyData[m].expense), backgroundColor: '#e74c3c' }
      ]
    };
  }, [transactions]);

  const barOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } };

  // ====== RENDER ======
  if (showCharts) {
    return (
      <div className="container">
        <ToastContainer position="top-right" autoClose={2000} />
        <h2>📊 Financial Charts</h2>
        <button className="back-button" onClick={() => setShowCharts(false)}>← Back to Dashboard</button>
        <div className="charts-wrapper">
          <div className="chart-container">
            <h3>Category-wise Spending</h3>
            <Pie ref={pieRef} data={pieData} options={pieOptions} redraw={true} />
          </div>
          <div className="chart-container">
            <h3>Monthly Income/Expense</h3>
            <Bar data={barData} options={barOptions} className="chart-canvas" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <ToastContainer position="top-right" autoClose={2000} />
      <h2>💰 Personal Finance Dashboard</h2>

      {/* ====== FORM SECTION ====== */}
      <div className="form-section">
        <form className="form" onSubmit={handleAddOrUpdate}>
          <div className="form-row">
            <div className="input-group">
              <input type="date" name="date" value={newTransaction.date} onChange={handleChange} title="Enter the transaction date" />
              {errors.date && <p className="error-message">{errors.date}</p>}
            </div>
            <div className="input-group">
              <input type="text" name="payee" placeholder="Payee" value={newTransaction.payee} onChange={handleChange} title="Enter the payee or recipient" />
              {errors.payee && <p className="error-message">{errors.payee}</p>}
            </div>
          </div>

          <div className="form-row">
            <div className="input-group">
              <select name="category" value={newTransaction.category} onChange={handleChange} title="Select the transaction category">
                <option value="">Select Category</option>
                {defaultCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              {errors.category && <p className="error-message">{errors.category}</p>}
            </div>
            <div className="input-group">
              <input type="number" name="amount" placeholder="Amount" value={newTransaction.amount} onChange={handleChange} title="Enter the transaction amount" />
              {errors.amount && <p className="error-message">{errors.amount}</p>}
            </div>
          </div>

          <div className="form-actions">
            {editTransactionId ? (
              <>
                <button type="submit" className="update-button">Update</button>
                <button type="button" onClick={() => resetForm('cancel')} className="cancel-button">Cancel</button>
              </>
            ) : <button type="submit" className="add-button">Add Transaction</button>}
          </div>
        </form>

        <div className="balance-box">
          <h3>💰 Balance</h3>
          <p className={`balance ${calculateBalance() >= 0 ? 'positive' : 'negative'}`}>
            ₹{calculateBalance().toFixed(2)}
          </p>
        </div>

        <button className="chart-button" onClick={() => setShowCharts(true)} title="View charts of your transactions">📊 See Charts</button>
      </div>

      {/* ====== FILTER SECTION ====== */}
      <div className="filter-section">
        <div className="filter-group">
          <label>Category</label>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} title="Filter transactions by category">
            {uniqueCategories.map(cat => <option key={cat}>{cat}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Payee</label>
          <input type="text" placeholder="Search Payee" value={filterPayee} onChange={e => setFilterPayee(e.target.value)} title="Search transactions by payee name" />
        </div>
        <div className="filter-group">
          <label>From</label>
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} title="Filter transactions from this date" />
        </div>
        <div className="filter-group">
          <label>To</label>
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} title="Filter transactions up to this date" />
        </div>
        <div>
          <button className='download-button' onClick={downloadCSV} title="Download filtered transactions as CSV">⬇ Download CSV</button>
        </div>
      </div>

      {/* ====== TRANSACTIONS TABLE ====== */}
      <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Payee</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedTransactions.length > 0 ? paginatedTransactions.map(txn => (
            <tr key={txn._id}>
              <td>{txn.date}</td>
              <td>{txn.payee}</td>
              <td>{txn.category}</td>
              <td style={{ color: txn.amount < 0 ? 'red' : 'green' }}>₹{txn.amount}</td>
              <td>
                <button onClick={() => handleEdit(txn)} className="edit-button" title="Edit this transaction">Edit</button>
                <button onClick={() => handleDelete(txn._id)} className="delete-button" title="Delete this transaction">Delete</button>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center' }}>No transactions found</td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      {/* ====== PAGINATION ====== */}
      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Previous</button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i + 1} className={currentPage === i + 1 ? 'active-page' : ''} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
          ))}
          <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next</button>
        </div>
      )}
    </div>
  );
}

export default App;