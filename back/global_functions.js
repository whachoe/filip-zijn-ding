function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateInternalUsername() {
  return `user_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

module.exports = { normalizeEmail, isValidEmail, generateInternalUsername };
