const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");
const sendMail = require("../utils/emailService");
const { registerLimiter, loginLimiter } = require("../middleware/rateLimiter");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Helper function
const generateToken = (payload, expiresIn = "10m") =>
  jwt.sign(payload, JWT_SECRET, { expiresIn });

// ========== 1. Register ==========
router.post("/register", registerLimiter, async (req, res) => {
  const { email } = req.body;
  const userExists = await User.findOne({ email });
  if (userExists) return res.status(400).send("Email already exists");

  const token = generateToken({ email });

  await User.create({ email, verificationToken: token });

  const link = `http://localhost:3000/verify?token=${token}`;
  await sendMail(
    email,
    "Email Verification",
    `<a href="${link}">Click to verify</a>`
  );
  res.send("Verification email sent");
});

// ========== 2. Verify Registration ==========
router.post("/verify", async (req, res) => {
  const { token, password } = req.body;
  try {
    const { email } = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ email, verificationToken: token });
    if (!user) return res.status(400).send("Invalid or expired token");

    const hashed = await bcrypt.hash(password, 10);
    user.password = hashed;
    user.verificationToken = null;
    user.isVerified = true;
    await user.save();
    res.send("User verified and registered");
  } catch (err) {
    res.status(400).send("Token expired or invalid");
  }
});

// ========== 3. Login ==========
router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !user.isVerified) return res.status(401).send("Unauthorized");

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).send("Invalid password");

  // Prevent multiple logins
  if (user.activeToken) return res.status(403).send("Already logged in");

  const token = generateToken({ userId: user._id }, "1h");
  user.activeToken = token;
  await user.save();

  res.json({ token });
});

// ========== 4. Logout ==========
router.post("/logout", auth, async (req, res) => {
  const user = await User.findById(req.user.userId);
  user.activeToken = null;
  await user.save();
  res.send("Logged out successfully");
});

// ========== 5. Protected ==========
router.get("/protected", auth, async (req, res) => {
  res.send("Protected content accessed!");
});

// ========== 6. Request Password Reset ==========
router.post("/reset-password-request", async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).send("Email not found");

  const token = generateToken({ email }, "15m");
  user.resetToken = token;
  user.resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  const link = `http://localhost:3000/reset-password?token=${token}`;
  await sendMail(
    email,
    "Reset Your Password",
    `<a href="${link}">Reset Password</a>`
  );
  res.send("Reset link sent");
});

// ========== 7. Reset Password ==========
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const { email } = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ email, resetToken: token });
    if (!user || new Date() > user.resetTokenExpiry)
      return res.status(400).send("Token expired or invalid");

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();
    res.send("Password reset successful");
  } catch {
    res.status(400).send("Invalid or expired token");
  }
});

module.exports = router;
