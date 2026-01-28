import { Injectable, Inject, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import type { ITripRepository } from '../../../domain/ports/trip.repository.port';
import type { IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import { TRIP_REPOSITORY, AGENCY_MEMBER_REPOSITORY } from '../../../domain/ports/tokens';

@Injectable()
export class DeleteTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: ITripRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
  ) {}

  async execute(agencyId: bigint, tripId: bigint, userId: string, isHost?: boolean): Promise<void> {
    // Verificar que el trip exista
    let trip;
    
    if (isHost || agencyId === BigInt(0)) {
      // Si es host, buscar por idTrip directamente
      trip = await this.tripRepository.findById(tripId);
      if (!trip) {
        throw new NotFoundException('Trip no encontrado');
      }
      // Verificar que el trip pertenezca al host
      if (trip.idHost !== userId) {
        throw new ForbiddenException('No tienes permiso para eliminar esta experiencia');
      }
    } else {
      // Si es agencia, buscar por agencia
      trip = await this.tripRepository.findByAgencyAndId(agencyId, tripId);
      if (!trip) {
        throw new NotFoundException('Trip no encontrado');
      }

      // Verificar que el usuario pertenezca a la agencia
      const membership = await this.agencyMemberRepository.findByAgencyAndUser(agencyId, userId);
      if (!membership) {
        throw new ForbiddenException('No tienes permiso para eliminar trips de esta agencia');
      }

      // Solo administradores pueden eliminar trips
      if (membership.role !== 'admin') {
        throw new ForbiddenException('Solo administradores pueden eliminar trips');
      }
    }

    // Verificar que no haya compras relacionadas con este trip
    const hasBookings = await this.tripRepository.hasBookings(tripId);
    if (hasBookings) {
      throw new BadRequestException('No se puede eliminar el trip porque tiene compras relacionadas');
    }

    await this.tripRepository.delete(tripId);
  }
}
