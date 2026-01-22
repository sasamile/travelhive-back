import { Injectable, Inject } from '@nestjs/common';
import type { IBookingRepository } from '../../../domain/ports/booking.repository.port';
import { BOOKING_REPOSITORY } from '../../../domain/ports/tokens';

@Injectable()
export class ListMyBookingsUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
  ) {}

  async execute(userId: string) {
    const bookings = await this.bookingRepository.findByOwner(userId);
    return {
      data: bookings.map((b) => ({
        idBooking: b.idBooking.toString(),
        idTrip: b.idTrip.toString(),
        idExpedition: b.idExpedition.toString(),
        idAgency: b.idAgency.toString(),
        status: b.status,
        subtotal: b.subtotal,
        serviceFee: b.serviceFee,
        discountCode: b.discountCode,
        discountAmount: b.discountAmount,
        totalBuy: b.totalBuy,
        currency: b.currency,
        dateBuy: b.dateBuy,
        createdAt: b.createdAt,
        bookingItems: (b.bookingItems || []).map((i) => ({
          id: i.id.toString(),
          itemType: i.itemType,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
        })),
      })),
    };
  }
}
