import { Injectable } from '@nestjs/common';
import { ITripRepository } from '../../domain/ports/trip.repository.port';
import { Trip, TripStatus } from '../../domain/entities/trip.entity';
import { PrismaService } from '../database/prisma/prisma.service';

@Injectable()
export class TripRepository implements ITripRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(trip: Partial<Trip>): Promise<Trip> {
    const created = await this.prisma.trip.create({
      data: {
        idAgency: trip.idAgency!,
        idCity: trip.idCity!,
        title: trip.title!,
        description: trip.description,
        category: trip.category!,
        vibe: trip.vibe,
        durationDays: trip.durationDays!,
        durationNights: trip.durationNights!,
        coverImage: trip.coverImage,
        status: trip.status || TripStatus.DRAFT,
      },
    });
    return this.mapToEntity(created);
  }

  async findById(id: bigint): Promise<Trip | null> {
    const trip = await this.prisma.trip.findUnique({
      where: { idTrip: id },
    });
    return trip ? this.mapToEntity(trip) : null;
  }

  async findByAgency(agencyId: bigint): Promise<Trip[]> {
    const trips = await this.prisma.trip.findMany({
      where: { idAgency: agencyId },
      orderBy: { createdAt: 'desc' },
    });
    return trips.map((trip) => this.mapToEntity(trip));
  }

  async update(id: bigint, data: Partial<Trip>): Promise<Trip> {
    const updated = await this.prisma.trip.update({
      where: { idTrip: id },
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        vibe: data.vibe,
        durationDays: data.durationDays,
        durationNights: data.durationNights,
        coverImage: data.coverImage,
        status: data.status,
        idCity: data.idCity,
      },
    });
    return this.mapToEntity(updated);
  }

  async delete(id: bigint): Promise<void> {
    await this.prisma.trip.delete({
      where: { idTrip: id },
    });
  }

  async findByAgencyAndId(agencyId: bigint, tripId: bigint): Promise<Trip | null> {
    const trip = await this.prisma.trip.findFirst({
      where: {
        idTrip: tripId,
        idAgency: agencyId,
      },
    });
    return trip ? this.mapToEntity(trip) : null;
  }

  private mapToEntity(prismaTrip: any): Trip {
    return new Trip({
      idTrip: prismaTrip.idTrip,
      idAgency: prismaTrip.idAgency,
      idCity: prismaTrip.idCity,
      title: prismaTrip.title,
      description: prismaTrip.description,
      category: prismaTrip.category,
      vibe: prismaTrip.vibe,
      durationDays: prismaTrip.durationDays,
      durationNights: prismaTrip.durationNights,
      coverImage: prismaTrip.coverImage,
      status: prismaTrip.status as TripStatus,
      createdAt: prismaTrip.createdAt,
      updatedAt: prismaTrip.updatedAt,
    });
  }
}
