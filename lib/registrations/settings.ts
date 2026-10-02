export type RegistrationSettings = {
  isOpen: boolean;
  capacity: number;
};

export function registrationPaymentPaid(state: any): boolean {
  return Boolean(state?.registrationPayment?.isPaid);
}

export function readRegistrationSettings(state: any, fallbackCapacity: number): RegistrationSettings {
  const cap = Number(state?.registration?.capacity);
  return {
    isOpen: state?.registration?.isOpen !== false,
    capacity: Number.isFinite(cap) && cap > 0 ? Math.min(128, Math.max(2, Math.floor(cap))) : Math.max(2, fallbackCapacity || 8),
  };
}

export function withRegistrationPaid(state: any, paymentInfo: any, teamCount: number) {
  const prev = readRegistrationSettings(state, teamCount);
  return {
    ...(state || {}),
    registrationPayment: paymentInfo,
    registration: {
      isOpen: prev.isOpen !== false,
      capacity: prev.capacity || teamCount,
    },
  };
}
