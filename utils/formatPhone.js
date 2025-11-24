function formatPhone(phone, defaultCountryCode = "+45") {
    if (!phone) return null;

    const cleaned = phone.toString().replace(/\D/g, "");

    // Pure 8-digit Danish number
    if (cleaned.length === 8) return defaultCountryCode + cleaned;

    // Starts with 45XXXXXXXX
    if (cleaned.startsWith("45") && cleaned.length === 10) return "+" + cleaned;

    // Starts with 0045XXXXXXXX
    if (cleaned.startsWith("0045") && cleaned.length === 12) return "+" + cleaned.substring(2);

    return null; // invalid
}

module.exports = formatPhone;
