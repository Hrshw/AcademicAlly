const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate'); // Middleware to protect routes
const sendVerificationEmail = require('../nodemailer/sendEmail');

const router = express.Router();

router.post('/verify-and-register', async (req, res) => {
  const { name, email, otp } = req.body; // Remove password from payload

  const normalizedEmail = email.trim().toLowerCase();
  console.log('📥 /verify-and-register request received:', {
    name,
    email: normalizedEmail,
    otp,
  });

  try {
    if (!name || !normalizedEmail || !otp) {
      console.log('❌ Missing required fields:', { name, email: normalizedEmail, otp });
      return res.status(400).json({ message: 'Name, email, and OTP are required' });
    }

    console.log('🔍 Searching for user with email:', normalizedEmail);
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      console.log('❌ User not found for email:', normalizedEmail);
      return res.status(400).json({ message: 'User not found. Please request an OTP first.' });
    }
    console.log('✅ User found:', {
      email: user.email,
      isVerified: user.isVerified,
      otp: user.otp || '[none]',
      password: user.password ? '[hashed]' : '[none]',
    });

    if (user.isVerified) {
      console.log('❌ User already registered:', normalizedEmail);
      return res.status(400).json({ message: 'User already registered. Please log in.' });
    }

    if (!user.otp || user.otp !== otp) {
      console.log('❌ OTP does not match:', { stored: user.otp, submitted: otp });
      return res.status(400).json({ message: 'Incorrect OTP' });
    }

    if (user.otpExpires < Date.now()) {
      console.log('❌ OTP expired:', { expiresAt: new Date(user.otpExpires) });
      return res.status(400).json({ message: 'OTP has expired' });
    }
    console.log('✅ OTP verified successfully:', normalizedEmail);

    user.name = name;
    user.email = normalizedEmail;
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;

    console.log('📝 Updating user:', { name, email: normalizedEmail });
    await user.save();
    console.log('✅ User registered successfully:', normalizedEmail);

    res.json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('🔥 Error in /verify-and-register:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/users/verify-email - Verify the user's email with OTP
router.post('/verify-email', async (req, res) => {
  const { email, otp } = req.body;

  console.log('🔐 Verifying email...');
  console.log('Payload received:', { email, otp });

  try {
    const user = await User.findOne({ email });

    if (!user) {
      console.log('❌ User not found.');
      return res.status(400).json({ message: 'User not found' });
    }

    // Check if user is already verified
    if (user.isVerified) {
      console.log('ℹ️ User already verified:', email);
      return res.status(200).json({ message: 'Email already verified' });
    }

    console.log('✅ User found:', user.email);
    console.log('Stored OTP:', user.otp, '| Expires at:', new Date(user.otpExpires));
    console.log('Submitted OTP:', otp);

    // Check OTP validity
    if (!user.otp || user.otp !== otp) {
      console.log('❌ OTP does not match');
      return res.status(400).json({ message: 'Incorrect OTP' });
    }

    if (user.otpExpires < Date.now()) {
      console.log('❌ OTP expired');
      return res.status(400).json({ message: 'OTP has expired' });
    }

    // Mark user as verified
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;

    await user.save();

    console.log('✅ Email verified successfully for:', email);
    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    console.error('🔥 Error verifying email:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


router.post('/send-otp', async (req, res) => {
  const { email, password } = req.body; // Add password to request
  const normalizedEmail = email.trim().toLowerCase();
  console.log("Received request to send OTP to:", normalizedEmail, { password: password ? '[provided]' : '[missing]' });

  try {
    if (!email || !password) {
      console.log('❌ Missing required fields:', { email, password: password ? '[provided]' : '[missing]' });
      return res.status(400).json({ message: 'Email and password are required' });
    }

    let user = await User.findOne({ email: normalizedEmail });
    console.log("User found?", !!user);

    if (!user) {
      console.log("Creating new user...");
      const hashedPassword = await bcrypt.hash(password, 10);
      user = new User({
        email: normalizedEmail,
        name: "",
        password: hashedPassword,
        isVerified: false,
      });
    } else {
      console.log("Resetting OTP fields for existing user:", normalizedEmail);
      user.otp = undefined;
      user.otpExpires = undefined;
      user.isVerified = false;
      // Don't overwrite password
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000;

    console.log("Generated OTP:", otp);

    user.otp = otp;
    user.otpExpires = otpExpires;

    await user.save();
    console.log("User saved with new OTP:", {
      email: normalizedEmail,
      password: user.password ? '[hashed]' : '[missing]',
      isVerified: user.isVerified,
    });

    await sendVerificationEmail(normalizedEmail, otp);
    console.log("OTP email sent successfully");

    res.json({ message: 'OTP sent to email' });
  } catch (err) {
    console.error("Error in /send-otp:", err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  console.log('📥 /login request received:', {
    email,
    password: password ? '[provided]' : '[missing]',
  });

  try {
    if (!email || !password) {
      console.log('❌ Missing required fields:', { email, password: password ? '[provided]' : '[missing]' });
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log('🔍 Searching for user with email:', normalizedEmail);

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      console.log('❌ User not found for email:', normalizedEmail);
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    console.log('✅ User found:', {
      email: user.email,
      isVerified: user.isVerified,
      password: user.password ? '[hashed]' : '[none]',
    });

    if (!user.isVerified) {
      console.log('❌ User not verified:', normalizedEmail);
      return res.status(400).json({ message: 'Please verify your email before logging in' });
    }

    console.log('🔒 Comparing passwords for:', normalizedEmail);
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('❌ Password does not match for:', normalizedEmail);
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    console.log('✅ Password matched successfully:', normalizedEmail);

    console.log('🔑 Generating JWT for:', normalizedEmail);
    if (!process.env.JWT_SECRET) {
      console.log('❌ JWT_SECRET not set');
      return res.status(500).json({ message: 'Server configuration error' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('✅ JWT generated successfully:', normalizedEmail);

    res.json({ token });
  } catch (err) {
    console.error('🔥 Login error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/users/profile - Get logged-in user's profile (protected)
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password'); // Exclude password from response
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/users/profile - Update logged-in user's profile (protected)
router.put('/profile', authenticate, async (req, res) => {
  const { name, email } = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { name, email },
      { new: true }
    ).select('-password'); // Exclude password from response

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
