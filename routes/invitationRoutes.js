const express = require('express');
const router = express.Router();
const InvitationRequest = require('../models/InvitationRequest');
const User = require('../models/User');

// Get invitation request details by uid
router.get('/invitation-request/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const data = await InvitationRequest.findOne({ uid });
    res.json(data || {});
  } catch (err) {
    res.status(500).json({ message: 'Error fetching invitation request', error: err.message });
  }
});

// Create or update invitation request
router.post('/invitation-request', async (req, res) => {
  try {
    const { uid, name, address, passportNumber, passportExpiry, country, dob } = req.body;
    if (!uid) return res.status(400).json({ message: 'UID is required' });
    const data = await InvitationRequest.findOneAndUpdate(
      { uid },
      { name, address, passportNumber, passportExpiry, country, dob },
      { upsert: true, new: true }
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Error saving invitation request', error: err.message });
  }
});

// Get user's abstract title
router.get('/invitation-abstract-title/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid });
    const title = user?.abstractSubmissions?.[0]?.title || '';
    res.json({ title });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching abstract title', error: err.message });
  }
});

module.exports = router; 