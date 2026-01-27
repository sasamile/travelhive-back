import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { ExpeditionStatus } from '../../domain/entities/expedition.entity';

@Injectable()
export class ExpeditionStatusUpdateService {
  private readonly logger = new Logger(ExpeditionStatusUpdateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Actualiza el estado de una expedición específica basado en:
   * - Ocupación: Si >= 100% con reservas CONFIRMED → FULL
   * - Fecha: Si la fecha de fin ya pasó → COMPLETED
   */
  async updateExpeditionStatus(expeditionId: bigint): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const expedition = await tx.expedition.findUnique({
        where: { idExpedition: expeditionId },
        include: {
          bookings: {
            where: { status: 'CONFIRMED' },
            include: {
              bookingItems: true,
            },
          },
        },
      });

      if (!expedition) {
        return;
      }

      const now = new Date();
      const endDate = new Date(expedition.endDate);
      let newStatus: ExpeditionStatus | null = null;

      // 1. Verificar si la fecha ya pasó → COMPLETED
      if (endDate < now && expedition.status !== ExpeditionStatus.COMPLETED) {
        newStatus = ExpeditionStatus.COMPLETED;
        this.logger.debug(
          `Expedición ${expeditionId.toString()} marcada como COMPLETED (fecha de fin: ${endDate.toISOString()})`,
        );
      }
      // 2. Verificar si está llena (ocupación >= 100%) → FULL
      else if (expedition.status !== ExpeditionStatus.COMPLETED && expedition.status !== ExpeditionStatus.CANCELLED) {
        const totalBookedSeats = expedition.bookings.reduce((sum, booking) => {
          return sum + booking.bookingItems.reduce((itemSum, item) => itemSum + item.quantity, 0);
        }, 0);

        const occupancyPercentage =
          expedition.capacityTotal > 0
            ? Math.round((totalBookedSeats / expedition.capacityTotal) * 100)
            : 0;

        // Si está llena (>= 100%) y no está ya marcada como FULL
        if (occupancyPercentage >= 100 && expedition.status !== ExpeditionStatus.FULL) {
          newStatus = ExpeditionStatus.FULL;
          this.logger.debug(
            `Expedición ${expeditionId.toString()} marcada como FULL (ocupación: ${occupancyPercentage}%)`,
          );
        }
        // Si no está llena (< 100%) y estaba marcada como FULL, volver a AVAILABLE
        else if (occupancyPercentage < 100 && expedition.status === ExpeditionStatus.FULL) {
          newStatus = ExpeditionStatus.AVAILABLE;
          this.logger.debug(
            `Expedición ${expeditionId.toString()} marcada como AVAILABLE (ocupación: ${occupancyPercentage}%, antes estaba FULL)`,
          );
        }
      }

      // Actualizar el estado si es necesario
      if (newStatus !== null) {
        await tx.expedition.update({
          where: { idExpedition: expeditionId },
          data: { status: newStatus },
        });
      }
    });
  }

  /**
   * Actualiza los estados de todas las expediciones activas
   * Se ejecuta cada minuto para mantener los estados actualizados
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async updateAllExpeditionsStatus() {
    try {
      const now = new Date();

      // Buscar expediciones que necesitan actualización de estado
      // 1. Expediciones con fecha pasada que no están COMPLETED
      // 2. Expediciones activas que pueden estar llenas o vacías
      const expeditionsToUpdate = await this.prisma.expedition.findMany({
        where: {
          status: {
            not: ExpeditionStatus.CANCELLED, // No actualizar canceladas
          },
        },
        include: {
          bookings: {
            where: { status: 'CONFIRMED' },
            include: {
              bookingItems: true,
            },
          },
        },
        take: 100, // Procesar máximo 100 a la vez
      });

      if (expeditionsToUpdate.length === 0) {
        return;
      }

      let updatedCount = 0;
      let fullCount = 0;
      let completedCount = 0;
      let availableCount = 0;

      for (const expedition of expeditionsToUpdate) {
        const endDate = new Date(expedition.endDate);
        let newStatus: ExpeditionStatus | null = null;

        // 1. Verificar si la fecha ya pasó → COMPLETED
        if (endDate < now && expedition.status !== ExpeditionStatus.COMPLETED) {
          newStatus = ExpeditionStatus.COMPLETED;
          completedCount++;
        }
        // 2. Verificar ocupación solo si no está completada o cancelada
        else if (expedition.status !== ExpeditionStatus.COMPLETED) {
          const totalBookedSeats = expedition.bookings.reduce((sum, booking) => {
            return sum + booking.bookingItems.reduce((itemSum, item) => itemSum + item.quantity, 0);
          }, 0);

          const occupancyPercentage =
            expedition.capacityTotal > 0
              ? Math.round((totalBookedSeats / expedition.capacityTotal) * 100)
              : 0;

          // Si está llena (>= 100%) y no está ya marcada como FULL
          if (occupancyPercentage >= 100 && expedition.status !== ExpeditionStatus.FULL) {
            newStatus = ExpeditionStatus.FULL;
            fullCount++;
          }
          // Si no está llena (< 100%) y estaba marcada como FULL, volver a AVAILABLE
          else if (occupancyPercentage < 100 && expedition.status === ExpeditionStatus.FULL) {
            newStatus = ExpeditionStatus.AVAILABLE;
            availableCount++;
          }
        }

        // Actualizar el estado si es necesario
        if (newStatus !== null) {
          await this.prisma.expedition.update({
            where: { idExpedition: expedition.idExpedition },
            data: { status: newStatus },
          });
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        this.logger.log(
          `✅ Actualizados ${updatedCount} estado(s) de expedición: ${fullCount} → FULL, ${completedCount} → COMPLETED, ${availableCount} → AVAILABLE`,
        );
      }
    } catch (error: any) {
      this.logger.error(`Error al actualizar estados de expediciones: ${error.message}`);
    }
  }
}
