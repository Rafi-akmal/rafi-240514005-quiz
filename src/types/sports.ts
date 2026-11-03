export type SportType = 'Futsal' | 'Badminton' | 'Basket' | (string & {});
export type FieldStatus = 'AVAILABLE' | 'MAINTENANCE';
export type BookingStatus = 'BOOKED' | 'CANCELLED' | 'COMPLETED';

export interface Field {
  id: string;
  name: string;
  sportType: SportType;
  pricePerHour: number;
  status: FieldStatus;
}

export interface Booking {
  id: string;
  fieldId: string;
  customerName: string;
  date: string; // Format: YYYY-MM-DD
  startTime: string; // Format: HH:mm
  endTime: string; // Format: HH:mm
  status: BookingStatus;
  totalPrice: number;
  createdAt: string;
}

export interface AvailabilityResult {
  fieldId: string;
  fieldName: string;
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
  reason: string;
}

export interface FieldScheduleResult {
  field: Field;
  date: string;
  bookedSlots: Array<{
    bookingId: string;
    date: string;
    startTime: string;
    endTime: string;
    customerName: string;
  }>;
}
