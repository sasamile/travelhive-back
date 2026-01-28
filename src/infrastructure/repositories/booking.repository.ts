import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { IBookingRepository } from '../../domain/ports/booking.repository.port';
import { Booking, BookingStatus } from '../../domain/entities/booking.entity';

@Injectable()
export class BookingRepository implements IBookingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOwner(userId: string): Promise<Booking[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { ownerBuy: userId },
      include: { bookingItems: true },
      orderBy: { createdAt: 'desc' },
    });

    return bookings.map((b) =>
      new Booking({
        idBooking: b.idBooking,
        idExpedition: b.idExpedition,
        idTrip: b.idTrip,
        idAgency: b.idAgency || undefined,
        ownerBuy: b.ownerBuy,
        dateBuy: b.dateBuy,
        referenceBuy: b.referenceBuy ?? undefined,
        status: b.status as BookingStatus,
        subtotal: b.subtotal,
        serviceFee: b.serviceFee,
        discountCode: b.discountCode ?? undefined,
        discountAmount: b.discountAmount,
        totalBuy: b.totalBuy,
        currency: b.currency,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        bookingItems: b.bookingItems?.map((i) => ({
          id: i.id,
          itemType: i.itemType,
          description: i.description ?? undefined,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
          createdAt: i.createdAt,
        })),
      }),
    );
  }
}
