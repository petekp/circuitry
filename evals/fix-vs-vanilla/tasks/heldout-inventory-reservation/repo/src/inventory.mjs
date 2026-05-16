export function availableStock({ stock, reservations, nowMs }) {
  const reserved = reservations.reduce((sum, reservation) => sum + reservation.quantity, 0);
  return Math.max(0, stock - reserved);
}
