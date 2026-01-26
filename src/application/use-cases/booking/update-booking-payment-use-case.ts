import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

export interface UpdateBookingPaymentInput {
  bookingId: bigint;
  transactionId: string;
  status: 'APPROVED' | 'DECLINED' | 'VOIDED';
  paymentSource?: string;
}

@Injectable()
export class UpdateBookingPaymentUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: UpdateBookingPaymentInput) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { idBooking: input.bookingId },
        include: {
          expedition: true,
          bookingItems: true,
        },
      });

      if (!booking) {
        throw new NotFoundException('Reserva no encontrada');
      }

      // Verificar que el transactionId coincida
      if (booking.transactionId !== input.transactionId) {
        throw new BadRequestException('Transaction ID no coincide con la reserva');
      }

      // Si ya está confirmada, no hacer nada
      if (booking.status === 'CONFIRMED') {
        return {
          idBooking: booking.idBooking.toString(),
          status: booking.status,
          message: 'Reserva ya estaba confirmada',
        };
      }

      let newStatus: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED' = 'PENDING';

      if (input.status === 'APPROVED') {
        newStatus = 'CONFIRMED';
      } else if (input.status === 'DECLINED' || input.status === 'VOIDED') {
        // Si el pago falla, devolver los cupos a la expedición
        const seatsToReturn = booking.bookingItems.reduce((sum, item) => sum + item.quantity, 0);
        
        await tx.expedition.update({
          where: { idExpedition: booking.idExpedition },
          data: { capacityAvailable: { increment: seatsToReturn } },
        });

        // Mantener PENDING o cambiar a CANCELLED según tu lógica de negocio
        // Por ahora mantenemos PENDING para que el usuario pueda reintentar
        newStatus = 'PENDING';
      }

      const updatedBooking = await tx.booking.update({
        where: { idBooking: input.bookingId },
        data: {
          status: newStatus,
          ...(input.paymentSource && { paymentSource: input.paymentSource }),
        },
        include: {
          bookingItems: true,
        },
      });

      return {
        idBooking: updatedBooking.idBooking.toString(),
        status: updatedBooking.status,
        message: newStatus === 'CONFIRMED' ? 'Reserva confirmada exitosamente' : 'Pago rechazado, cupos devueltos',
      };
    });
  }
}
