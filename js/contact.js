// Email / phone helpers for the profile editor and the WhatsApp link.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

export const PHONE_HINT = "Incluye el código de país, por ejemplo +34 600 000 000";

export function isEmail(value) {
  return EMAIL_REGEX.test(value.trim());
}

// Returns the number as "+<country code><digits>", or null when it is not valid.
export function normalizePhone(value) {
  const compact = value.trim().replace(/[\s().-]/g, "");
  const withPlus = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  return PHONE_REGEX.test(withPlus) ? withPlus : null;
}

// Digits only, the format wa.me links expect.
export function whatsappUrl(phone) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
