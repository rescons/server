const Registration = require('../models/Registration');
const { createPhonePePayment, verifyPayment } = require('../services/phonepeService');

exports.initiateRegistration = async (req, res) => {
  try {
    const registrationData = req.body;
    
    // Create registration record with pending payment status
    const registration = new Registration({
      ...registrationData,
      paymentStatus: 'pending'
    });
    await registration.save();

    // Initialize PhonePe payment
    const paymentResponse = await createPhonePePayment({
      amount: registrationData.amount,
      registrationId: registration._id,
      email: registrationData.email,
      phone: registrationData.phone
    });

    res.json({
      success: true,
      paymentUrl: paymentResponse.paymentUrl,
      registrationId: registration._id
    });
  } catch (error) {
    console.error('Registration initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate registration'
    });
  }
};

exports.handlePaymentWebhook = async (req, res) => {
  try {
    const { registrationId, paymentId, status, transactionId } = req.body;
    
    // Verify payment with PhonePe
    const paymentVerification = await verifyPayment(paymentId);
    
    if (paymentVerification.status === 'SUCCESS') {
      await Registration.findByIdAndUpdate(registrationId, {
        paymentStatus: 'completed',
        paymentId,
        transactionId
      });

      // Send confirmation email
      await sendConfirmationEmail(registrationId);
    } else {
      await Registration.findByIdAndUpdate(registrationId, {
        paymentStatus: 'failed',
        paymentId
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Payment webhook error:', error);
    res.status(500).json({ success: false });
  }
};