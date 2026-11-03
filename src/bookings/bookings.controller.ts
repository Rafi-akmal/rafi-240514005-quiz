import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BookingsService } from './bookings.service.js';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  getAllBookings(
    @Query('fieldId') fieldId?: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
  ) {
    return this.bookingsService.findAll({ fieldId, date, status });
  }

  @Get('availability')
  checkAvailability(
    @Query('fieldId') fieldId: string,
    @Query('date') date: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    return this.bookingsService.checkAvailability(
      fieldId,
      date,
      startTime,
      endTime,
    );
  }

  @Get(':id')
  getBookingDetail(@Param('id') id: string) {
    return this.bookingsService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createBooking(@Body() body: any) {
    return this.bookingsService.createBooking(body);
  }

  @Patch(':id/cancel')
  cancelBooking(@Param('id') id: string) {
    return this.bookingsService.cancelBooking(id);
  }

  @Delete(':id')
  deleteBooking(@Param('id') id: string) {
    return this.bookingsService.cancelBooking(id);
  }

  @Patch(':id/complete')
  completeBooking(@Param('id') id: string) {
    return this.bookingsService.completeBooking(id);
  }
}
