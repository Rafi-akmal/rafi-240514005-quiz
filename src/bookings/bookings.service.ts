import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  Booking,
  AvailabilityResult,
  FieldScheduleResult,
} from '../types/sports.js';
import { FieldsService } from '../fields/fields.service.js';

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') return -1;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return -1;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return -1;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return -1;
  return hours * 60 + minutes;
}

@Injectable()
export class BookingsService {
  private bookings: Booking[] = [];
  private bookingCounter = 0;

  constructor(private readonly fieldsService: FieldsService) {}

  findAll(filter?: {
    fieldId?: string;
    date?: string;
    status?: string;
  }): Booking[] {
    let result = [...this.bookings];
    if (filter?.fieldId) {
      result = result.filter((b) => b.fieldId === filter.fieldId);
    }
    if (filter?.date) {
      result = result.filter((b) => b.date === filter.date);
    }
    if (filter?.status) {
      result = result.filter((b) => b.status === filter.status);
    }
    return result;
  }

  findById(id: string): Booking {
    const booking = this.bookings.find((b) => b.id === id);
    if (!booking) {
      throw new NotFoundException(`Booking dengan ID "${id}" tidak ditemukan`);
    }
    return booking;
  }

  createBooking(payload: any): Booking {
    if (
      !payload ||
      !payload.fieldId ||
      !payload.date ||
      !payload.startTime ||
      !payload.endTime
    ) {
      throw new BadRequestException(
        'fieldId, date, startTime, dan endTime wajib diisi',
      );
    }

    // 1. Cek apakah lapangan ditemukan
    const field = this.fieldsService.findById(payload.fieldId);

    // 2. Cek status lapangan
    if (field.status !== 'AVAILABLE') {
      throw new BadRequestException(
        `Lapangan "${field.name}" sedang ${field.status.toLowerCase()} dan tidak dapat dipesan`,
      );
    }

    // 3. Validasi jam mulai dan jam selesai
    const startMinutes = parseTimeToMinutes(payload.startTime);
    const endMinutes = parseTimeToMinutes(payload.endTime);

    if (startMinutes < 0 || endMinutes < 0 || startMinutes >= endMinutes) {
      throw new BadRequestException(
        'Format jam tidak valid atau jam mulai harus lebih awal dari jam selesai',
      );
    }

    // 4. Cek jadwal bentrok (hanya dengan booking berstatus BOOKED)
    // Reservasi yang dibatalkan (CANCELLED) tidak boleh dianggap sebagai slot terpakai.
    const conflictingBooking = this.bookings.find((b) => {
      if (
        b.fieldId !== payload.fieldId ||
        b.date !== payload.date ||
        b.status !== 'BOOKED'
      ) {
        return false;
      }
      const bStart = parseTimeToMinutes(b.startTime);
      const bEnd = parseTimeToMinutes(b.endTime);
      return startMinutes < bEnd && endMinutes > bStart;
    });

    if (conflictingBooking) {
      throw new ConflictException(
        `Jadwal bentrok: slot waktu ${payload.startTime} - ${payload.endTime} pada tanggal ${payload.date} sudah dipesan (Booking ID: ${conflictingBooking.id})`,
      );
    }

    // 5. Hitung total biaya
    const durationHours = (endMinutes - startMinutes) / 60;
    const totalPrice = Math.round(durationHours * field.pricePerHour);

    // 6. Simpan booking ke dalam array
    this.bookingCounter++;
    const newBooking: Booking = {
      id: `BOOK-${this.bookingCounter.toString().padStart(3, '0')}`,
      fieldId: payload.fieldId,
      customerName: payload.customerName
        ? String(payload.customerName).trim()
        : 'Pelanggan Umum',
      date: payload.date,
      startTime: payload.startTime,
      endTime: payload.endTime,
      status: 'BOOKED',
      totalPrice,
      createdAt: new Date().toISOString(),
    };

    this.bookings.push(newBooking);
    return newBooking;
  }

  cancelBooking(id: string): Booking {
    const booking = this.findById(id);

    if (booking.status === 'CANCELLED') {
      throw new BadRequestException(
        `Booking dengan ID "${id}" sudah dibatalkan sebelumnya`,
      );
    }

    booking.status = 'CANCELLED';
    return booking;
  }

  completeBooking(id: string): Booking {
    const booking = this.findById(id);

    if (booking.status === 'CANCELLED') {
      throw new BadRequestException(
        `Booking dengan ID "${id}" sudah dibatalkan dan tidak dapat diselesaikan`,
      );
    }

    booking.status = 'COMPLETED';
    return booking;
  }

  checkAvailability(
    fieldId: string,
    date: string,
    startTime: string,
    endTime: string,
  ): AvailabilityResult {
    const field = this.fieldsService.findById(fieldId);

    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);

    if (startMinutes < 0 || endMinutes < 0 || startMinutes >= endMinutes) {
      throw new BadRequestException(
        'Format jam tidak valid atau jam mulai harus lebih awal dari jam selesai',
      );
    }

    const conflictingBooking = this.bookings.find((b) => {
      if (b.fieldId !== fieldId || b.date !== date || b.status !== 'BOOKED') {
        return false;
      }
      const bStart = parseTimeToMinutes(b.startTime);
      const bEnd = parseTimeToMinutes(b.endTime);
      return startMinutes < bEnd && endMinutes > bStart;
    });

    const isAvailable = !conflictingBooking && field.status === 'AVAILABLE';
    let reason = 'Slot tersedia untuk dipesan';

    if (conflictingBooking) {
      reason = `Slot waktu sudah dipesan (Booking ID: ${conflictingBooking.id})`;
    } else if (field.status !== 'AVAILABLE') {
      reason = `Lapangan sedang ${field.status.toLowerCase()}`;
    }

    return {
      fieldId,
      fieldName: field.name,
      date,
      startTime,
      endTime,
      available: isAvailable,
      reason,
    };
  }

  getFieldSchedule(fieldId: string, date?: string): FieldScheduleResult {
    const field = this.fieldsService.findById(fieldId);

    let bookings = this.bookings.filter(
      (b) => b.fieldId === fieldId && b.status === 'BOOKED',
    );

    if (date) {
      bookings = bookings.filter((b) => b.date === date);
    }

    bookings.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime);
    });

    return {
      field,
      date: date || 'Semua Tanggal',
      bookedSlots: bookings.map((b) => ({
        bookingId: b.id,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        customerName: b.customerName,
      })),
    };
  }

  reset(): void {
    this.bookings = [];
    this.bookingCounter = 0;
  }
}
