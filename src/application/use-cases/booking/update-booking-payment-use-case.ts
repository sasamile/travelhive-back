import { BadRequestException, Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { ExpeditionStatusUpdateService } from '../../services/expedition-status-update.service';
import { QRCodeService } from '../../services/qr-code.service';

export interface UpdateBookingPaymentInput {
  bookingId: bigint;
  transactionId: string;
  status: 'APPROVED' | 'DECLINED' | 'VOIDED';
  paymentSource?: string;
}

@Injectable()
export class UpdateBookingPaymentUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ExpeditionStatusUpdateService))
    private readonly expeditionStatusUpdateService: ExpeditionStatusUpdateService,
    private readonly qrCodeService: QRCodeService,
  ) {}

  async execute(input: UpdateBookingPaymentInput) {
    // Obtener el idExpedition antes de la transacción para actualizar el estado después
    const bookingForExpedition = await this.prisma.booking.findUnique({
      where: { idBooking: input.bookingId },
      select: { idExpedition: true },
    });

    if (!bookingForExpedition) {
      throw new NotFoundException('Reserva no encontrada');
    }

    const result = await this.prisma.$transaction(async (tx) => {
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
          wasConfirmed: false, // Ya estaba confirmada antes
        };
      }

      let newStatus: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED' = 'PENDING';

      if (input.status === 'APPROVED') {
        newStatus = 'CONFIRMED';
        
        // Incrementar contador de referidos del promoter usado en la reserva (si existe)
        if (booking.promoterCode) {
          const promoter = await tx.promoter.findUnique({
            where: { code: booking.promoterCode },
          });
          
          if (promoter) {
            await tx.promoter.update({
              where: { id: promoter.id },
              data: { referralCount: { increment: 1 } },
            });
          }
        }
        
        // También incrementar contador del promoter asociado al trip (si existe y es diferente)
        const trip = await tx.trip.findUnique({
          where: { idTrip: booking.idTrip },
          select: { idPromoter: true },
        });
        
        if (trip?.idPromoter) {
          // Solo incrementar si no es el mismo promoter que ya incrementamos arriba
          const promoterFromTrip = await tx.promoter.findUnique({
            where: { id: trip.idPromoter },
            select: { code: true },
          });
          
          if (promoterFromTrip && promoterFromTrip.code !== booking.promoterCode) {
            await tx.promoter.update({
              where: { id: trip.idPromoter },
              data: { referralCount: { increment: 1 } },
            });
          }
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

        // Incluir esta reserva que se está confirmando ahora
        const allConfirmedBookings = [
          ...confirmedBookings,
          {
            ...booking,
            status: 'CONFIRMED' as const,
            bookingItems: booking.bookingItems,
          },
        ];

        const bookedSeatsFromConfirmed = allConfirmedBookings.reduce((total, b) => {
          return (
            total +
            b.bookingItems.reduce((sum, item) => sum + item.quantity, 0)
          );
        }, 0);

        const realCapacityAvailable = Math.max(0, booking.expedition.capacityTotal - bookedSeatsFromConfirmed);

        // Actualizar capacityAvailable con el valor real calculado
        // También actualizar el estado de la expedición si está llena
        const occupancyPercentage =
          booking.expedition.capacityTotal > 0
            ? Math.round((bookedSeatsFromConfirmed / booking.expedition.capacityTotal) * 100)
            : 0;

        let expeditionStatus = booking.expedition.status;
        if (occupancyPercentage >= 100 && booking.expedition.status !== 'FULL' && booking.expedition.status !== 'COMPLETED') {
          expeditionStatus = 'FULL';
        }

        await tx.expedition.update({
          where: { idExpedition: booking.idExpedition },
          data: {
            capacityAvailable: realCapacityAvailable,
            ...(expeditionStatus !== booking.expedition.status && { status: expeditionStatus }),
          },
        });
      } else if (input.status === 'DECLINED' || input.status === 'VOIDED') {
        // Si el pago falla, recalcular capacityAvailable basado solo en CONFIRMED
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
        wasConfirmed: newStatus === 'CONFIRMED',
      };
    }, {
      timeout: 10000, // Aumentar timeout a 10 segundos para transacciones largas
    });

    // Generar QR code FUERA de la transacción si la reserva fue confirmada
    // Esto evita que la generación de la imagen bloquee la transacción
    let qrCodeData: { qrCode: string; qrImageUrl: string } | null = null;
    if (result.wasConfirmed) {
      try {
        qrCodeData = await this.qrCodeService.generateQRForBooking(input.bookingId);
      } catch (error: any) {
        // No fallar si hay error al generar QR, solo loguear
        console.warn(`Error al generar QR para booking ${input.bookingId}: ${error.message}`);
      }
    }

    // Actualizar el estado de la expedición después de la transacción
    // Esto verifica si está llena o si la fecha pasó
    if (input.status === 'APPROVED' && result.wasConfirmed && bookingForExpedition) {
      try {
        await this.expeditionStatusUpdateService.updateExpeditionStatus(bookingForExpedition.idExpedition);
      } catch (error: any) {
        // No fallar si hay error al actualizar el estado, solo loguear
        console.warn(`Error al actualizar estado de expedición: ${error.message}`);
      }
    }

    return {
      idBooking: result.idBooking,
      status: result.status,
      message: result.message,
      qrCode: qrCodeData?.qrCode || null,
      qrImageUrl: qrCodeData?.qrImageUrl || null,
    };
  }
}
