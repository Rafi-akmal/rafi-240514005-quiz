import { Injectable, NotFoundException } from '@nestjs/common';
import { Field } from '../types/sports.js';

@Injectable()
export class FieldsService {
  private fields: Field[] = [
    {
      id: 'lapangan-1',
      name: 'Lapangan Futsal A',
      sportType: 'Futsal',
      pricePerHour: 100000,
      status: 'AVAILABLE',
    },
    {
      id: 'lapangan-2',
      name: 'Lapangan Futsal B',
      sportType: 'Futsal',
      pricePerHour: 100000,
      status: 'AVAILABLE',
    },
    {
      id: 'lapangan-3',
      name: 'Lapangan Badminton 1',
      sportType: 'Badminton',
      pricePerHour: 60000,
      status: 'AVAILABLE',
    },
    {
      id: 'lapangan-4',
      name: 'Lapangan Basket Outdoor',
      sportType: 'Basket',
      pricePerHour: 80000,
      status: 'MAINTENANCE',
    },
  ];

  findAll(): Field[] {
    return [...this.fields];
  }

  findById(id: string): Field {
    const field = this.fields.find((f) => f.id === id);
    if (!field) {
      throw new NotFoundException(`Lapangan dengan ID "${id}" tidak ditemukan`);
    }
    return field;
  }

  create(fieldData: any): Field {
    const newField: Field = {
      id: fieldData.id || `lapangan-${this.fields.length + 1}`,
      name: fieldData.name,
      sportType: fieldData.sportType,
      pricePerHour: Number(fieldData.pricePerHour),
      status: fieldData.status || 'AVAILABLE',
    };
    this.fields.push(newField);
    return newField;
  }

  reset(): void {
    this.fields = [
      {
        id: 'lapangan-1',
        name: 'Lapangan Futsal A',
        sportType: 'Futsal',
        pricePerHour: 100000,
        status: 'AVAILABLE',
      },
      {
        id: 'lapangan-2',
        name: 'Lapangan Futsal B',
        sportType: 'Futsal',
        pricePerHour: 100000,
        status: 'AVAILABLE',
      },
      {
        id: 'lapangan-3',
        name: 'Lapangan Badminton 1',
        sportType: 'Badminton',
        pricePerHour: 60000,
        status: 'AVAILABLE',
      },
      {
        id: 'lapangan-4',
        name: 'Lapangan Basket Outdoor',
        sportType: 'Basket',
        pricePerHour: 80000,
        status: 'MAINTENANCE',
      },
    ];
  }
}

