const nodemailer = require('nodemailer');

// Use the same email as in transporter and in mailOptions.from
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'f20210894@pilani.bits-pilani.ac.in',
    pass: 'sxmd kvcm kmrs dqyr', // Consider moving this to a .env file for security
  },
});
const sendVerificationEmail = async (email, otp) => {
    const mailOptions = {
      from: 'f20210894@pilani.bits-pilani.ac.in',
      to: email,
      subject: 'Verify your email',
      text: `Your verification OTP is: ${otp}`,
    };
  
    console.log("Sending email to:", email);
    try {
      await transporter.sendMail(mailOptions);
      console.log("Email sent successfully to:", email);
    } catch (error) {
      console.error("Error sending email:", error);
      throw error; // rethrow so the route catches it
    }
  };
  

module.exports = sendVerificationEmail;
