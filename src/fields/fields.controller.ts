import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FieldsService } from './fields.service.js';
import { BookingsService } from '../bookings/bookings.service.js';

@Controller('fields')
export class FieldsController {
  constructor(
    private readonly fieldsService: FieldsService,
    private readonly bookingsService: BookingsService,
  ) {}

  @Get()
  getAllFields() {
    return this.fieldsService.findAll();
  }

  @Get(':id')
  getFieldDetail(@Param('id') id: string) {
    return this.fieldsService.findById(id);
  }

  @Get(':id/schedule')
  getFieldSchedule(@Param('id') id: string, @Query('date') date?: string) {
    return this.bookingsService.getFieldSchedule(id, date);
  }

  @Get(':id/availability')
  checkFieldAvailability(
    @Param('id') id: string,
    @Query('date') date: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    return this.bookingsService.checkAvailability(id, date, startTime, endTime);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createField(@Body() body: any) {
    return this.fieldsService.create(body);
  }
}
