const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: false },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false }, // Allow null until set
  otp: { type: String },
  otpExpires: { type: Date },
  isVerified: { type: Boolean, default: false },
});

// Normalize email
UserSchema.pre('save', function (next) {
  if (this.isModified('email')) {
    this.email = this.email.trim().toLowerCase();
  }
  next();
});

// Remove password hashing hook, as we handle it explicitly
// If you need a hook, add validation instead
UserSchema.pre('save', async function (next) {
  if (!this.password && this.isVerified) {
    throw new Error('Password is required for verified users');
  }
  next();
});

module.exports = mongoose.model('User', UserSchema);