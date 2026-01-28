import { Injectable, Inject, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import type { IExpeditionRepository } from '../../../domain/ports/expedition.repository.port';
import type { ITripRepository } from '../../../domain/ports/trip.repository.port';
import type { IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import { EXPEDITION_REPOSITORY, TRIP_REPOSITORY, AGENCY_MEMBER_REPOSITORY } from '../../../domain/ports/tokens';
import { Expedition } from '../../../domain/entities/expedition.entity';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { UpdateExpeditionDto } from '../../../presentation/dto/update-expedition.dto';

@Injectable()
export class UpdateExpeditionUseCase {
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
    data: UpdateExpeditionDto,
    userId: string,
  ): Promise<Expedition> {
    // Verificar que el trip exista
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new NotFoundException('Trip no encontrado');
    }

    // Verificar permisos: debe ser agencia o host del trip
    if (trip.idAgency) {
      // Es una agencia, verificar membresía
      const membership = await this.agencyMemberRepository.findByAgencyAndUser(
        trip.idAgency,
        userId,
      );
      if (!membership) {
        throw new ForbiddenException('No tienes permiso para actualizar expediciones en esta agencia');
      }
      // Verificar que el usuario tenga rol de admin o editor
      if (!['admin', 'editor'].includes(membership.role)) {
        throw new ForbiddenException('Solo administradores y editores pueden actualizar expediciones');
      }
    } else if (trip.idHost) {
      // Es un host, verificar que sea el dueño
      if (trip.idHost !== userId) {
        throw new ForbiddenException('No tienes permiso para actualizar expediciones de esta experiencia');
      }
    } else {
      throw new ForbiddenException('Trip no tiene agencia ni host asociado');
    }

    // Verificar que la expedición exista y pertenezca al trip
    const expedition = await this.expeditionRepository.findByTripAndId(tripId, expeditionId);
    if (!expedition) {
      throw new NotFoundException('Expedición no encontrada');
    }

    // IMPORTANTE: Solo bloquear edición si hay reservas CONFIRMED, no PENDING
    // Las reservas PENDING no deben bloquear la edición porque el pago no se completó
    const confirmedBookings = await this.prisma.booking.count({
      where: {
        idExpedition: expeditionId,
        status: 'CONFIRMED', // Solo contar reservas confirmadas
      },
    });

    if (confirmedBookings > 0) {
      throw new BadRequestException(
        `No se puede editar esta expedición porque tiene ${confirmedBookings} reserva(s) confirmada(s). Solo se pueden editar expediciones sin reservas confirmadas.`,
      );
    }

    // Preparar los datos de actualización
    const updateData: Partial<Expedition> = {};

    if (data.startDate !== undefined) {
      updateData.startDate = new Date(data.startDate);
    }
    if (data.endDate !== undefined) {
      updateData.endDate = new Date(data.endDate);
    }
    if (data.capacityTotal !== undefined) {
      updateData.capacityTotal = data.capacityTotal;
    }
    if (data.capacityAvailable !== undefined) {
      updateData.capacityAvailable = data.capacityAvailable;
    }
    if (data.priceAdult !== undefined) {
      updateData.priceAdult = data.priceAdult;
    }
    if (data.priceChild !== undefined) {
      updateData.priceChild = data.priceChild;
    }
    if (data.currency !== undefined) {
      updateData.currency = data.currency;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    const updatedExpedition = await this.expeditionRepository.update(expeditionId, updateData);
    return updatedExpedition;
  }
}
