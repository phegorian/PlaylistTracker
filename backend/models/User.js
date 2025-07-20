// backend/models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Import bcrypt for password hashing

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true, // Ensure usernames are unique
    trim: true,   // Remove whitespace from both ends of a string
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true, // Store emails in lowercase
    match: [/.+@.+\..+/, 'Please fill a valid email address'] // Basic email regex validation
  },
  password: {
    type: String,
    required: true,
    minlength: 6 // Enforce minimum password length
  }
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps
});

// --- Mongoose Middleware (pre-save hook) ---
// This will run BEFORE a user document is saved to the database.
// It's used here to hash the password.
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10); // Generate a salt (cost factor 10)
    this.password = await bcrypt.hash(this.password, salt); // Hash the password with the salt
    next(); // Proceed with saving
  } catch (err) {
    next(err); // Pass error to next middleware
  }
});

// --- Instance Method for password comparison ---
// This method will be available on any User document (e.g., user.matchPassword(password))
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;