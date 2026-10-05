/** Thrown when a role, or a separation-of-duties rule, forbids an action. Routes turn it into a 403. */
export class PermissionError extends Error {}
