export function normalizePhoneForCall(value?: string | null) {
  if (!value) return "";
  if (/@lid\b/.test(value)) return "";
  let digits = value.replace(/@.+$/, "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}

export function preferredCallPeer(data: { callerPn?: string | null; peer?: string | null }) {
  return normalizePhoneForCall(data.callerPn) || normalizePhoneForCall(data.peer) || "";
}
