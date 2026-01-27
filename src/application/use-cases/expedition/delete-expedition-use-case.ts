import { Injectable, Inject, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import type { IExpeditionRepository } from '../../../domain/ports/expedition.repository.port';
import type { ITripRepository } from '../../../domain/ports/trip.repository.port';
import type { IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import { EXPEDITION_REPOSITORY, TRIP_REPOSITORY, AGENCY_MEMBER_REPOSITORY } from '../../../domain/ports/tokens';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { ExpeditionStatus } from '../../../domain/entities/expedition.entity';

@Injectable()
export class DeleteExpeditionUseCase {
  constructor(
    @Inject(EXPEDITION_REPOSITORY)
    private readonly expeditionRepository: IExpeditionRepository,
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: ITripRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    tripId: bigint,
    expeditionId: bigint,
    userId: string,
  ): Promise<void> {
    // Verificar que el trip exista
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new NotFoundException('Trip no encontrado');
    }

    // Verificar que el usuario pertenezca a la agencia del trip
    const membership = await this.agencyMemberRepository.findByAgencyAndUser(
      trip.idAgency,
      userId,
    );
    if (!membership) {
      throw new ForbiddenException('No tienes permiso para eliminar expediciones en esta agencia');
    }

    // Solo administradores pueden eliminar expediciones
    if (membership.role !== 'admin') {
      throw new ForbiddenException('Solo administradores pueden eliminar expediciones');
    }

    // Verificar que la expedición exista y pertenezca al trip
    const expedition = await this.expeditionRepository.findByTripAndId(tripId, expeditionId);
    if (!expedition) {
      throw new NotFoundException('Expedición no encontrada');
    }

    // Verificar que NO tenga ninguna reserva (ni PENDING ni CONFIRMED)
    const bookingsCount = await this.prisma.booking.count({
      where: {
        idExpedition: expeditionId,
        status: {
          in: ['PENDING', 'CONFIRMED'], // Cualquier reserva, sin importar el estado
        },
      },
    });

    if (bookingsCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar esta expedición porque tiene ${bookingsCount} reserva(s) asociada(s). Solo se pueden eliminar expediciones sin reservas.`,
      );
    }

    // Verificar que la expedición esté en un estado que permita eliminación
    // Permitimos eliminar expediciones en estados: CANCELLED, o cualquier estado si no tiene reservas
    // Pero recomendamos que esté en CANCELLED o no publicada
    const allowedStatusesForDeletion = [
      ExpeditionStatus.CANCELLED,
      // También permitimos eliminar si está en otros estados pero sin reservas
      // Esto da flexibilidad al admin
    ];

    // Si tiene un estado que normalmente no se debería eliminar, pero no tiene reservas,
    // permitimos la eliminación (el admin sabe lo que hace)
    // Solo advertimos si está en AVAILABLE o FULL (estados activos)
    if (expedition.status === ExpeditionStatus.AVAILABLE || expedition.status === ExpeditionStatus.FULL) {
      // Permitimos eliminación pero podría ser un warning en el futuro
      // Por ahora permitimos si no tiene reservas
    }

    // Si todo está bien, eliminar la expedición
    await this.expeditionRepository.delete(expeditionId);
  }
}
