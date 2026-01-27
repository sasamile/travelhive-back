import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { CancelPendingBookingUseCase } from '../use-cases/booking/cancel-pending-booking-use-case';

@Injectable()
export class BookingCleanupService {
  private readonly logger = new Logger(BookingCleanupService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly cancelPendingBookingUseCase: CancelPendingBookingUseCase,
  ) {}

  /**
   * Ejecuta cada minuto para cancelar reservas PENDING que excedan el tiempo límite
   * Configurado para 10 minutos por defecto (configurable vía env: PENDING_BOOKING_TIMEOUT_MINUTES)
   * 
   * Ejemplo: Si PENDING_BOOKING_TIMEOUT_MINUTES=5, cancela reservas PENDING después de 5 minutos
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handlePendingBookingsCleanup() {
    // Tiempo límite en minutos (por defecto 10, configurable vía .env)
    const timeoutMinutes = parseInt(process.env.PENDING_BOOKING_TIMEOUT_MINUTES || '10', 10);
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const cutoffTime = new Date(Date.now() - timeoutMs);

    try {
      // Buscar reservas PENDING que fueron creadas hace más de X minutos
      const pendingBookings = await this.prisma.booking.findMany({
        where: {
          status: 'PENDING',
          createdAt: {
            lt: cutoffTime, // Creadas antes del tiempo límite
          },
        },
        select: {
          idBooking: true,
          createdAt: true,
          owner: {
            select: {
              email: true,
            },
          },
        },
        take: 100, // Procesar máximo 100 a la vez para no sobrecargar
      });

      if (pendingBookings.length === 0) {
        return; // No hay reservas pendientes para cancelar
      }

      this.logger.log(
        `Encontradas ${pendingBookings.length} reserva(s) PENDING que exceden ${timeoutMinutes} minutos. Cancelando...`,
      );

      let cancelledCount = 0;
      let errorCount = 0;

      // Cancelar cada reserva
      for (const booking of pendingBookings) {
        try {
          await this.cancelPendingBookingUseCase.execute(booking.idBooking);
          cancelledCount++;
          this.logger.debug(
            `Reserva ${booking.idBooking.toString()} cancelada automáticamente (creada hace ${Math.round((Date.now() - booking.createdAt.getTime()) / 60000)} minutos)`,
          );
        } catch (error: any) {
          errorCount++;
          this.logger.error(
            `Error al cancelar reserva ${booking.idBooking.toString()}: ${error.message}`,
          );
        }
      }

      if (cancelledCount > 0) {
        this.logger.log(
          `✅ ${cancelledCount} reserva(s) PENDING cancelada(s) automáticamente. ${errorCount > 0 ? `${errorCount} error(es).` : ''}`,
        );
      }
    } catch (error: any) {
      this.logger.error(`Error en limpieza automática de reservas PENDING: ${error.message}`);
    }
  }
}
