import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { IExpeditionRepository } from '../../../domain/ports/expedition.repository.port';
import type { ITripRepository } from '../../../domain/ports/trip.repository.port';
import type { IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import { EXPEDITION_REPOSITORY, TRIP_REPOSITORY, AGENCY_MEMBER_REPOSITORY } from '../../../domain/ports/tokens';
import { Expedition, ExpeditionStatus } from '../../../domain/entities/expedition.entity';

export interface CreateExpeditionDto {
  idTrip: bigint;
  startDate: Date;
  endDate: Date;
  capacityTotal: number;
  capacityAvailable?: number;
  priceAdult: number;
  priceChild?: number;
  currency?: string;
  status?: ExpeditionStatus;
}

@Injectable()
export class CreateExpeditionUseCase {
  constructor(
    @Inject(EXPEDITION_REPOSITORY)
    private readonly expeditionRepository: IExpeditionRepository,
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: ITripRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
  ) {}

  async execute(data: CreateExpeditionDto, userId: string): Promise<Expedition> {
    // Verificar que el trip exista
    const trip = await this.tripRepository.findById(data.idTrip);
    if (!trip) {
      throw new NotFoundException('Trip no encontrado');
    }

    // Verificar que el usuario pertenezca a la agencia del trip
    const membership = await this.agencyMemberRepository.findByAgencyAndUser(
      trip.idAgency,
      userId,
    );
    if (!membership) {
      throw new ForbiddenException('No tienes permiso para crear expediciones en esta agencia');
    }

    // Verificar que el usuario tenga rol de admin o editor
    if (!['admin', 'editor'].includes(membership.role)) {
      throw new ForbiddenException('Solo administradores y editores pueden crear expediciones');
    }

    const expedition = await this.expeditionRepository.create({
      ...data,
      capacityAvailable: data.capacityAvailable ?? data.capacityTotal,
      currency: data.currency || 'USD',
      status: data.status || ExpeditionStatus.AVAILABLE,
    });

    return expedition;
  }
}
