const holdHours = 48; // Or "48" as string
const holdExpiry = new Date(Date.now() + holdHours * 3600000).toISOString();
console.log("holdExpiry:", holdExpiry);
const expiry = new Date(holdExpiry);
const now = new Date();
console.log("now > expiry:", now > expiry);

const strHoldHours = "48";
const holdExpiryStr = new Date(Date.now() + strHoldHours * 3600000).toISOString();
console.log("holdExpiryStr:", holdExpiryStr);
