import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

@Injectable()
export class CancelPendingBookingUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cancela una reserva PENDING y devuelve los cupos a la expedición
   */
  async execute(bookingId: bigint): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { idBooking: bookingId },
        include: {
          bookingItems: true,
          expedition: true,
        },
      });

      if (!booking) {
        return; // Ya no existe, no hacer nada
      }

      // Solo cancelar si está en PENDING
      if (booking.status !== 'PENDING') {
        return; // Ya no está pendiente, no hacer nada
      }

      // Recalcular capacityAvailable basado SOLO en reservas CONFIRMED
      // Esto asegura que el campo esté sincronizado correctamente
      const confirmedBookings = await tx.booking.findMany({
        where: {
          idExpedition: booking.idExpedition,
          status: 'CONFIRMED',
        },
        include: {
          bookingItems: true,
        },
      });

      const bookedSeatsFromConfirmed = confirmedBookings.reduce((total, b) => {
        return (
          total +
          b.bookingItems.reduce((sum, item) => sum + item.quantity, 0)
        );
      }, 0);

      const realCapacityAvailable = Math.max(0, booking.expedition.capacityTotal - bookedSeatsFromConfirmed);

      // Actualizar capacityAvailable con el valor real calculado
      await tx.expedition.update({
        where: { idExpedition: booking.idExpedition },
        data: { capacityAvailable: realCapacityAvailable },
      });

      // Cancelar la reserva
      await tx.booking.update({
        where: { idBooking: bookingId },
        data: { status: 'CANCELLED' },
      });
    });
  }
}
