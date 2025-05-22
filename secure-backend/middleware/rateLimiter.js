const rateLimit = require("express-rate-limit");

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many registration attempts. Please try again later.",
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts. Please try again later.",
});

module.exports = { registerLimiter, loginLimiter };
