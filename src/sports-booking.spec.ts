import { describe, it, expect, beforeEach } from 'vitest';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { FieldsService } from './fields/fields.service.js';
import { BookingsService } from './bookings/bookings.service.js';
import { FieldsController } from './fields/fields.controller.js';
import { BookingsController } from './bookings/bookings.controller.js';

describe('Sistem Reservasi Lapangan Olahraga (Quiz API)', () => {
  let fieldsService: FieldsService;
  let bookingsService: BookingsService;
  let fieldsController: FieldsController;
  let bookingsController: BookingsController;

  beforeEach(() => {
    fieldsService = new FieldsService();
    bookingsService = new BookingsService(fieldsService);
    fieldsController = new FieldsController(fieldsService, bookingsService);
    bookingsController = new BookingsController(bookingsService);
  });

  describe('Skenario 1: Daftar lapangan dan cek ketersediaan', () => {
    it('harus dapat menampilkan daftar semua lapangan dengan atribut lengkap', () => {
      const fields = fieldsController.getAllFields();
      expect(fields).toBeDefined();
      expect(fields.length).toBeGreaterThan(0);

      const field = fields[0];
      expect(field).toHaveProperty('id');
      expect(field).toHaveProperty('name');
      expect(field).toHaveProperty('sportType');
      expect(field).toHaveProperty('pricePerHour');
      expect(field).toHaveProperty('status');
      expect(['AVAILABLE', 'MAINTENANCE']).toContain(field.status);
    });

    it('harus dapat menampilkan detail lapangan berdasarkan ID', () => {
      const field = fieldsController.getFieldDetail('lapangan-1');
      expect(field).toBeDefined();
      expect(field.id).toBe('lapangan-1');
      expect(field.name).toBe('Lapangan Futsal A');
      expect(field.sportType).toBe('Futsal');
      expect(field.pricePerHour).toBe(100000);
      expect(field.status).toBe('AVAILABLE');
    });

    it('harus dapat mengecek ketersediaan slot waktu yang masih kosong', () => {
      const availability = fieldsController.checkFieldAvailability(
        'lapangan-1',
        '2026-11-03',
        '09:00',
        '11:00',
      );

      expect(availability.available).toBe(true);
      expect(availability.fieldId).toBe('lapangan-1');
      expect(availability.date).toBe('2026-11-03');
      expect(availability.startTime).toBe('09:00');
      expect(availability.endTime).toBe('11:00');
    });

    it('harus dapat melihat jadwal lapangan yang masih kosong atau memiliki reservasi', () => {
      const schedule = fieldsController.getFieldSchedule(
        'lapangan-1',
        '2026-11-03',
      );
      expect(schedule.field.id).toBe('lapangan-1');
      expect(schedule.date).toBe('2026-11-03');
      expect(schedule.bookedSlots).toEqual([]);
    });

    it('harus menandakan tidak tersedia jika lapangan dalam status MAINTENANCE', () => {
      const availability = fieldsController.checkFieldAvailability(
        'lapangan-4', // Lapangan Basket Outdoor dalam status MAINTENANCE
        '2026-11-03',
        '10:00',
        '12:00',
      );

      expect(availability.available).toBe(false);
      expect(availability.reason).toContain('maintenance');
    });
  });

  describe('Skenario 2: Booking berhasil dibuat', () => {
    it('harus berhasil membuat booking baru pada slot waktu yang tersedia', () => {
      const payload = {
        fieldId: 'lapangan-1',
        customerName: 'Rafi Akmal',
        date: '2026-11-03',
        startTime: '09:00',
        endTime: '11:00',
      };

      const booking = bookingsController.createBooking(payload);

      expect(booking).toBeDefined();
      expect(booking.id).toMatch(/^BOOK-\d{3}$/);
      expect(booking.fieldId).toBe('lapangan-1');
      expect(booking.customerName).toBe('Rafi Akmal');
      expect(booking.date).toBe('2026-11-03');
      expect(booking.startTime).toBe('09:00');
      expect(booking.endTime).toBe('11:00');
      expect(booking.status).toBe('BOOKED');
      // 2 jam * 100.000 = 200.000
      expect(booking.totalPrice).toBe(200000);
      expect(booking.createdAt).toBeDefined();
    });

    it('harus menyimpan booking dan dapat dilihat di daftar reservasi', () => {
      bookingsController.createBooking({
        fieldId: 'lapangan-1',
        customerName: 'Budi Santoso',
        date: '2026-11-03',
        startTime: '13:00',
        endTime: '14:00',
      });

      const allBookings = bookingsController.getAllBookings();
      expect(allBookings.length).toBe(1);
      expect(allBookings[0].customerName).toBe('Budi Santoso');

      const detail = bookingsController.getBookingDetail(allBookings[0].id);
      expect(detail.id).toBe(allBookings[0].id);
      expect(detail.status).toBe('BOOKED');
    });

    it('harus menampilkan slot yang sudah dipesan pada jadwal lapangan', () => {
      bookingsController.createBooking({
        fieldId: 'lapangan-1',
        customerName: 'Siti Aminah',
        date: '2026-11-03',
        startTime: '15:00',
        endTime: '17:00',
      });

      const schedule = fieldsController.getFieldSchedule(
        'lapangan-1',
        '2026-11-03',
      );
      expect(schedule.bookedSlots.length).toBe(1);
      expect(schedule.bookedSlots[0].startTime).toBe('15:00');
      expect(schedule.bookedSlots[0].endTime).toBe('17:00');
    });
  });

  describe('Skenario 3: Booking ditolak saat jadwal bentrok', () => {
    beforeEach(() => {
      // Buat booking eksisting di lapangan-1: 09:00 - 11:00
      bookingsController.createBooking({
        fieldId: 'lapangan-1',
        customerName: 'User Pertama',
        date: '2026-11-03',
        startTime: '09:00',
        endTime: '11:00',
      });
    });

    it('harus menolak booking jika jam sama persis dengan booking yang ada', () => {
      expect(() => {
        bookingsController.createBooking({
          fieldId: 'lapangan-1',
          customerName: 'User Kedua',
          date: '2026-11-03',
          startTime: '09:00',
          endTime: '11:00',
        });
      }).toThrowError(ConflictException);
    });

    it('harus menolak booking jika overlap di awal slot eksisting (contoh: 08:30 - 10:00)', () => {
      expect(() => {
        bookingsController.createBooking({
          fieldId: 'lapangan-1',
          customerName: 'User Kedua',
          date: '2026-11-03',
          startTime: '08:30',
          endTime: '10:00',
        });
      }).toThrowError(ConflictException);
    });

    it('harus menolak booking jika overlap di akhir slot eksisting (contoh: 10:00 - 12:00)', () => {
      expect(() => {
        bookingsController.createBooking({
          fieldId: 'lapangan-1',
          customerName: 'User Kedua',
          date: '2026-11-03',
          startTime: '10:00',
          endTime: '12:00',
        });
      }).toThrowError(ConflictException);
    });

    it('harus menolak booking jika berada di dalam slot eksisting (contoh: 09:30 - 10:30)', () => {
      expect(() => {
        bookingsController.createBooking({
          fieldId: 'lapangan-1',
          customerName: 'User Kedua',
          date: '2026-11-03',
          startTime: '09:30',
          endTime: '10:30',
        });
      }).toThrowError(ConflictException);
    });

    it('harus menolak booking jika mencakup seluruh slot eksisting (contoh: 08:00 - 12:00)', () => {
      expect(() => {
        bookingsController.createBooking({
          fieldId: 'lapangan-1',
          customerName: 'User Kedua',
          date: '2026-11-03',
          startTime: '08:00',
          endTime: '12:00',
        });
      }).toThrowError(ConflictException);
    });

    it('harus mengizinkan booking pada slot bersebelahan (back-to-back: 08:00 - 09:00 dan 11:00 - 12:00)', () => {
      const bookingBefore = bookingsController.createBooking({
        fieldId: 'lapangan-1',
        customerName: 'User Pagi',
        date: '2026-11-03',
        startTime: '08:00',
        endTime: '09:00',
      });
      expect(bookingBefore.status).toBe('BOOKED');

      const bookingAfter = bookingsController.createBooking({
        fieldId: 'lapangan-1',
        customerName: 'User Siang',
        date: '2026-11-03',
        startTime: '11:00',
        endTime: '12:00',
      });
      expect(bookingAfter.status).toBe('BOOKED');
    });

    it('harus mengizinkan booking pada jam yang sama tetapi di lapangan yang berbeda', () => {
      const bookingDifferentField = bookingsController.createBooking({
        fieldId: 'lapangan-2',
        customerName: 'User Lapangan Lain',
        date: '2026-11-03',
        startTime: '09:00',
        endTime: '11:00',
      });
      expect(bookingDifferentField.status).toBe('BOOKED');
      expect(bookingDifferentField.fieldId).toBe('lapangan-2');
    });

    it('harus mengizinkan booking pada jam yang sama tetapi di tanggal yang berbeda', () => {
      const bookingDifferentDate = bookingsController.createBooking({
        fieldId: 'lapangan-1',
        customerName: 'User Besok',
        date: '2026-11-04',
        startTime: '09:00',
        endTime: '11:00',
      });
      expect(bookingDifferentDate.status).toBe('BOOKED');
      expect(bookingDifferentDate.date).toBe('2026-11-04');
    });
  });

  describe('Skenario 4: Lapangan atau booking tidak ditemukan', () => {
    it('harus menolak melihat detail lapangan yang tidak ada dengan NotFoundException', () => {
      expect(() => {
        fieldsController.getFieldDetail('lapangan-999');
      }).toThrowError(NotFoundException);
    });

    it('harus menolak booking dengan fieldId yang tidak ada dengan NotFoundException', () => {
      expect(() => {
        bookingsController.createBooking({
          fieldId: 'lapangan-tidak-ada',
          customerName: 'Penasaran',
          date: '2026-11-03',
          startTime: '10:00',
          endTime: '11:00',
        });
      }).toThrowError(NotFoundException);
    });

    it('harus menolak melihat detail booking yang tidak ada dengan NotFoundException', () => {
      expect(() => {
        bookingsController.getBookingDetail('BOOK-999');
      }).toThrowError(NotFoundException);
    });

    it('harus menolak pembatalan booking yang tidak ada dengan NotFoundException', () => {
      expect(() => {
        bookingsController.cancelBooking('BOOK-999');
      }).toThrowError(NotFoundException);
    });
  });

  describe('Skenario 5: Booking dibatalkan dan slot tersedia kembali', () => {
    it('harus berhasil membatalkan booking dan mengubah status menjadi CANCELLED', () => {
      const booking = bookingsController.createBooking({
        fieldId: 'lapangan-1',
        customerName: 'User Batal',
        date: '2026-11-03',
        startTime: '09:00',
        endTime: '11:00',
      });

      expect(booking.status).toBe('BOOKED');

      const cancelledBooking = bookingsController.cancelBooking(booking.id);
      expect(cancelledBooking.id).toBe(booking.id);
      expect(cancelledBooking.status).toBe('CANCELLED');
    });

    it('harus memastikan slot tersedia kembali setelah booking dibatalkan', () => {
      // 1. Buat booking
      const booking = bookingsController.createBooking({
        fieldId: 'lapangan-1',
        customerName: 'User Batal',
        date: '2026-11-03',
        startTime: '09:00',
        endTime: '11:00',
      });

      // 2. Verifikasi sebelum dibatalkan, slot tidak tersedia
      const availBefore = bookingsController.checkAvailability(
        'lapangan-1',
        '2026-11-03',
        '09:00',
        '11:00',
      );
      expect(availBefore.available).toBe(false);

      // 3. Batalkan booking
      bookingsController.cancelBooking(booking.id);

      // 4. Verifikasi setelah dibatalkan, slot kembali tersedia
      const availAfter = bookingsController.checkAvailability(
        'lapangan-1',
        '2026-11-03',
        '09:00',
        '11:00',
      );
      expect(availAfter.available).toBe(true);

      // 5. Pengguna lain dapat memesan slot yang sama persis tanpa error bentrok
      const newBooking = bookingsController.createBooking({
        fieldId: 'lapangan-1',
        customerName: 'User Baru Pengganti',
        date: '2026-11-03',
        startTime: '09:00',
        endTime: '11:00',
      });

      expect(newBooking.status).toBe('BOOKED');
      expect(newBooking.customerName).toBe('User Baru Pengganti');
    });

    it('harus menolak pembatalan ulang jika booking sudah berstatus CANCELLED', () => {
      const booking = bookingsController.createBooking({
        fieldId: 'lapangan-1',
        customerName: 'User Batal',
        date: '2026-11-03',
        startTime: '09:00',
        endTime: '11:00',
      });

      bookingsController.cancelBooking(booking.id);

      expect(() => {
        bookingsController.cancelBooking(booking.id);
      }).toThrowError(BadRequestException);
    });
  });

  describe('Validasi Tambahan', () => {
    it('harus menolak pembuatan booking jika parameter wajib tidak lengkap', () => {
      expect(() => {
        bookingsController.createBooking({
          fieldId: 'lapangan-1',
          date: '2026-11-03',
        });
      }).toThrowError(BadRequestException);
    });

    it('harus menolak booking jika jam selesai lebih awal atau sama dengan jam mulai', () => {
      expect(() => {
        bookingsController.createBooking({
          fieldId: 'lapangan-1',
          date: '2026-11-03',
          startTime: '10:00',
          endTime: '09:00',
        });
      }).toThrowError(BadRequestException);

      expect(() => {
        bookingsController.createBooking({
          fieldId: 'lapangan-1',
          date: '2026-11-03',
          startTime: '10:00',
          endTime: '10:00',
        });
      }).toThrowError(BadRequestException);
    });

    it('harus menolak booking jika format jam tidak valid', () => {
      expect(() => {
        bookingsController.createBooking({
          fieldId: 'lapangan-1',
          date: '2026-11-03',
          startTime: 'invalid',
          endTime: '10:00',
        });
      }).toThrowError(BadRequestException);
    });

    it('harus menolak booking jika lapangan sedang maintenance', () => {
      expect(() => {
        bookingsController.createBooking({
          fieldId: 'lapangan-4', // MAINTENANCE
          date: '2026-11-03',
          startTime: '09:00',
          endTime: '10:00',
        });
      }).toThrowError(BadRequestException);
    });

    it('harus dapat mengubah status booking menjadi COMPLETED', () => {
      const booking = bookingsController.createBooking({
        fieldId: 'lapangan-1',
        customerName: 'User Selesai',
        date: '2026-11-03',
        startTime: '18:00',
        endTime: '19:00',
      });

      const completed = bookingsController.completeBooking(booking.id);
      expect(completed.status).toBe('COMPLETED');
    });
  });
});
