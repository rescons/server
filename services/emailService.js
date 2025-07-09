const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  // Configure your email service
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

exports.sendConfirmationEmail = async (registrationId) => {
  try {
    const registration = await Registration.findById(registrationId);
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: registration.email,
      subject: 'Registration Confirmation',
      html: `
        <h1>Registration Confirmed</h1>
        <p>Dear ${registration.firstName},</p>
        <p>Your registration has been successfully completed.</p>
        <p>Registration Details:</p>
        <ul>
          <li>Registration Type: ${registration.registrationType}</li>
          <li>Amount Paid: $${registration.amount}</li>
          <li>Transaction ID: ${registration.transactionId}</li>
        </ul>
        <p>Thank you for registering!</p>
      `
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};