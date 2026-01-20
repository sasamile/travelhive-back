import { Injectable } from '@nestjs/common';
import { IExpeditionRepository } from '../../domain/ports/expedition.repository.port';
import { Expedition, ExpeditionStatus } from '../../domain/entities/expedition.entity';
import { PrismaService } from '../database/prisma/prisma.service';

@Injectable()
export class ExpeditionRepository implements IExpeditionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(expedition: Partial<Expedition>): Promise<Expedition> {
    const created = await this.prisma.expedition.create({
      data: {
        idTrip: expedition.idTrip!,
        startDate: expedition.startDate!,
        endDate: expedition.endDate!,
        capacityTotal: expedition.capacityTotal!,
        capacityAvailable: expedition.capacityAvailable ?? expedition.capacityTotal!,
        priceAdult: expedition.priceAdult!,
        priceChild: expedition.priceChild,
        currency: expedition.currency || 'USD',
        status: expedition.status || ExpeditionStatus.AVAILABLE,
      },
    });
    return this.mapToEntity(created);
  }

  async findById(id: bigint): Promise<Expedition | null> {
    const expedition = await this.prisma.expedition.findUnique({
      where: { idExpedition: id },
    });
    return expedition ? this.mapToEntity(expedition) : null;
  }

  async findByTrip(tripId: bigint): Promise<Expedition[]> {
    const expeditions = await this.prisma.expedition.findMany({
      where: { idTrip: tripId },
      orderBy: { startDate: 'asc' },
    });
    return expeditions.map((expedition) => this.mapToEntity(expedition));
  }

  async update(id: bigint, data: Partial<Expedition>): Promise<Expedition> {
    const updated = await this.prisma.expedition.update({
      where: { idExpedition: id },
      data: {
        startDate: data.startDate,
        endDate: data.endDate,
        capacityTotal: data.capacityTotal,
        capacityAvailable: data.capacityAvailable,
        priceAdult: data.priceAdult,
        priceChild: data.priceChild,
        currency: data.currency,
        status: data.status,
      },
    });
    return this.mapToEntity(updated);
  }

  async delete(id: bigint): Promise<void> {
    await this.prisma.expedition.delete({
      where: { idExpedition: id },
    });
  }

  async findByTripAndId(tripId: bigint, expeditionId: bigint): Promise<Expedition | null> {
    const expedition = await this.prisma.expedition.findFirst({
      where: {
        idExpedition: expeditionId,
        idTrip: tripId,
      },
    });
    return expedition ? this.mapToEntity(expedition) : null;
  }

  private mapToEntity(prismaExpedition: any): Expedition {
    return new Expedition({
      idExpedition: prismaExpedition.idExpedition,
      idTrip: prismaExpedition.idTrip,
      startDate: prismaExpedition.startDate,
      endDate: prismaExpedition.endDate,
      capacityTotal: prismaExpedition.capacityTotal,
      capacityAvailable: prismaExpedition.capacityAvailable,
      priceAdult: Number(prismaExpedition.priceAdult),
      priceChild: prismaExpedition.priceChild ? Number(prismaExpedition.priceChild) : undefined,
      currency: prismaExpedition.currency,
      status: prismaExpedition.status as ExpeditionStatus,
      createdAt: prismaExpedition.createdAt,
      updatedAt: prismaExpedition.updatedAt,
    });
  }
}
