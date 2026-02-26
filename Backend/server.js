const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   MongoDB Connection
================================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

/* ===============================
   Transaction Schema
================================= */
const transactionSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  payee: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  amount: { 
    type: Number, 
    required: true,
    min: 0
  }
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

/* ===============================
   Home Route
================================= */
app.get("/", (req, res) => {
  res.send("Personal Finance Backend API is running 🚀");
});

/* ===============================
   GET Transactions (With Filters)
================================= */
app.get('/api/transactions', async (req, res) => {
  try {
    const { category, payee, dateFrom, dateTo } = req.query;

    const filter = {};

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (payee) {
      filter.payee = { $regex: payee, $options: 'i' };
    }

    if (dateFrom || dateTo) {
      filter.date = {};

      if (dateFrom && !isNaN(new Date(dateFrom))) {
        filter.date.$gte = new Date(dateFrom);
      }

      if (dateTo && !isNaN(new Date(dateTo))) {
        filter.date.$lte = new Date(dateTo);
      }

      if (Object.keys(filter.date).length === 0) {
        delete filter.date;
      }
    }

    const transactions = await Transaction
      .find(filter)
      .sort({ date: -1 });

    res.json(transactions);

  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

/* ===============================
   ADD Transaction
================================= */
app.post('/api/transactions', async (req, res) => {
  try {
    let { date, payee, category, amount } = req.body;

    amount = Number(amount);

    const txn = new Transaction({
      date: new Date(date),
      payee,
      category,
      amount
    });

    await txn.save();

    res.status(201).json({
      message: 'Transaction added successfully',
      data: txn
    });

  } catch (err) {
    console.error('FULL ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   UPDATE Transaction
================================= */
app.put('/api/transactions/:id', async (req, res) => {
  try {
    const txnId = req.params.id;

    const updatedData = { ...req.body };

    if (updatedData.date) {
      updatedData.date = new Date(updatedData.date);
    }

    const updatedTxn = await Transaction.findByIdAndUpdate(
      txnId,
      updatedData,
      { new: true, runValidators: true }
    );

    if (!updatedTxn) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.status(200).json({
      message: 'Transaction updated successfully',
      data: updatedTxn
    });

  } catch (err) {
    console.error('Error updating transaction:', err);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

/* ===============================
   DELETE Transaction
================================= */
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const deletedTxn = await Transaction.findByIdAndDelete(req.params.id);

    if (!deletedTxn) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.status(200).json({
      message: 'Transaction deleted successfully',
      data: deletedTxn
    });

  } catch (err) {
    console.error('Error deleting transaction:', err);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

/* ===============================
   Monthly Summary API
   (Without type)
================================= */
app.get('/api/summary/monthly', async (req, res) => {
  try {
    const summary = await Transaction.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" }
          },
          total: { $sum: "$amount" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    res.json(summary);

  } catch (err) {
    console.error('Error fetching summary:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

/* ===============================
   Server
================================= */
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});