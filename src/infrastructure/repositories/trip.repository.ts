import { Injectable } from '@nestjs/common';
import { ITripRepository } from '../../domain/ports/trip.repository.port';
import {
  Trip,
  TripStatus,
  TripCategory,
  RoutePoint,
  TripGalleryImage,
  ItineraryDay,
} from '../../domain/entities/trip.entity';
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
        category: trip.category! as any,
        destinationRegion: trip.destinationRegion,
        latitude: trip.latitude ? trip.latitude : null,
        longitude: trip.longitude ? trip.longitude : null,
        startDate: trip.startDate,
        endDate: trip.endDate,
        durationDays: trip.durationDays!,
        durationNights: trip.durationNights!,
        price: trip.price ? trip.price : null,
        currency: trip.currency as any,
        priceType: trip.priceType as any,
        maxPersons: trip.maxPersons,
        coverImage: trip.coverImage,
        coverImageIndex: trip.coverImageIndex,
        status: (trip.status || TripStatus.DRAFT) as any,
        isActive: trip.isActive ?? true,
        publishedAt: trip.publishedAt,
        routePoints: trip.routePoints
          ? {
              create: trip.routePoints.map((rp) => ({
                name: rp.name,
                latitude: rp.latitude,
                longitude: rp.longitude,
                order: rp.order,
              })),
            }
          : undefined,
        galleryImages: trip.galleryImages
          ? {
              create: trip.galleryImages.map((gi) => ({
                imageUrl: gi.imageUrl,
                order: gi.order,
              })),
            }
          : undefined,
        itineraryDays: trip.itineraryDays
          ? {
              create: trip.itineraryDays.map((day) => ({
                day: day.day,
                title: day.title,
                subtitle: day.subtitle,
                order: day.order,
                activities: {
                  create: day.activities.map((act) => ({
                    type: act.type as any,
                    title: act.title,
                    description: act.description,
                    time: act.time,
                    imageUrl: act.imageUrl,
                    latitude: act.latitude ? act.latitude : null,
                    longitude: act.longitude ? act.longitude : null,
                    poiId: act.poiId,
                    order: act.order,
                  })),
                },
              })),
            }
          : undefined,
      },
      include: {
        routePoints: true,
        galleryImages: true,
        itineraryDays: {
          include: {
            activities: true,
          },
        },
      },
    });
    return this.mapToEntity(created);
  }

  async findById(id: bigint): Promise<Trip | null> {
    const trip = await this.prisma.trip.findUnique({
      where: { idTrip: id },
      include: {
        routePoints: true,
        galleryImages: true,
        itineraryDays: {
          include: {
            activities: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });
    return trip ? this.mapToEntity(trip) : null;
  }

  async findByAgency(agencyId: bigint): Promise<Trip[]> {
    const trips = await this.prisma.trip.findMany({
      where: { idAgency: agencyId },
      include: {
        routePoints: true,
        galleryImages: true,
        itineraryDays: {
          include: {
            activities: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return trips.map((trip) => this.mapToEntity(trip));
  }

  async update(id: bigint, data: Partial<Trip>): Promise<Trip> {
    // Primero eliminar relaciones existentes si se están actualizando
    if (data.routePoints || data.galleryImages || data.itineraryDays) {
      await this.prisma.routePoint.deleteMany({ where: { idTrip: id } });
      await this.prisma.tripGalleryImage.deleteMany({ where: { idTrip: id } });
      await this.prisma.itineraryActivity.deleteMany({
        where: { idDay: { in: (await this.prisma.itineraryDay.findMany({ where: { idTrip: id }, select: { id: true } })).map((d) => d.id) } },
      });
      await this.prisma.itineraryDay.deleteMany({ where: { idTrip: id } });
    }

    const updated = await this.prisma.trip.update({
      where: { idTrip: id },
      data: {
        title: data.title,
        description: data.description,
        category: data.category as any,
        destinationRegion: data.destinationRegion,
        latitude: data.latitude !== undefined ? (data.latitude ? data.latitude : null) : undefined,
        longitude: data.longitude !== undefined ? (data.longitude ? data.longitude : null) : undefined,
        startDate: data.startDate,
        endDate: data.endDate,
        durationDays: data.durationDays,
        durationNights: data.durationNights,
        price: data.price !== undefined ? (data.price ? data.price : null) : undefined,
        currency: data.currency as any,
        priceType: data.priceType as any,
        maxPersons: data.maxPersons,
        coverImage: data.coverImage,
        coverImageIndex: data.coverImageIndex,
        status: data.status as any,
        isActive: data.isActive,
        publishedAt: data.publishedAt,
        idCity: data.idCity,
        routePoints: data.routePoints
          ? {
              create: data.routePoints.map((rp) => ({
                name: rp.name,
                latitude: rp.latitude,
                longitude: rp.longitude,
                order: rp.order,
              })),
            }
          : undefined,
        galleryImages: data.galleryImages
          ? {
              create: data.galleryImages.map((gi) => ({
                imageUrl: gi.imageUrl,
                order: gi.order,
              })),
            }
          : undefined,
        itineraryDays: data.itineraryDays
          ? {
              create: data.itineraryDays.map((day) => ({
                day: day.day,
                title: day.title,
                subtitle: day.subtitle,
                order: day.order,
                activities: {
                  create: day.activities.map((act) => ({
                    type: act.type as any,
                    title: act.title,
                    description: act.description,
                    time: act.time,
                    imageUrl: act.imageUrl,
                    latitude: act.latitude ? act.latitude : null,
                    longitude: act.longitude ? act.longitude : null,
                    poiId: act.poiId,
                    order: act.order,
                  })),
                },
              })),
            }
          : undefined,
      },
      include: {
        routePoints: true,
        galleryImages: true,
        itineraryDays: {
          include: {
            activities: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
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
      include: {
        routePoints: true,
        galleryImages: true,
        itineraryDays: {
          include: {
            activities: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });
    return trip ? this.mapToEntity(trip) : null;
  }

  async hasBookings(tripId: bigint): Promise<boolean> {
    const bookingCount = await this.prisma.booking.count({
      where: {
        idTrip: tripId,
      },
    });
    return bookingCount > 0;
  }

  private mapToEntity(prismaTrip: any): Trip {
    return new Trip({
      idTrip: prismaTrip.idTrip,
      idAgency: prismaTrip.idAgency,
      idCity: prismaTrip.idCity,
      title: prismaTrip.title,
      description: prismaTrip.description,
      category: prismaTrip.category as TripCategory,
      destinationRegion: prismaTrip.destinationRegion,
      latitude: prismaTrip.latitude ? Number(prismaTrip.latitude) : undefined,
      longitude: prismaTrip.longitude ? Number(prismaTrip.longitude) : undefined,
      startDate: prismaTrip.startDate ? new Date(prismaTrip.startDate) : undefined,
      endDate: prismaTrip.endDate ? new Date(prismaTrip.endDate) : undefined,
      durationDays: prismaTrip.durationDays,
      durationNights: prismaTrip.durationNights,
      price: prismaTrip.price ? Number(prismaTrip.price) : undefined,
      currency: prismaTrip.currency,
      priceType: prismaTrip.priceType,
      maxPersons: prismaTrip.maxPersons,
      coverImage: prismaTrip.coverImage,
      coverImageIndex: prismaTrip.coverImageIndex,
      status: prismaTrip.status as TripStatus,
      isActive: prismaTrip.isActive ?? true,
      publishedAt: prismaTrip.publishedAt ? new Date(prismaTrip.publishedAt) : undefined,
      createdAt: prismaTrip.createdAt ? new Date(prismaTrip.createdAt) : new Date(),
      updatedAt: prismaTrip.updatedAt ? new Date(prismaTrip.updatedAt) : new Date(),
      routePoints: prismaTrip.routePoints
        ? prismaTrip.routePoints.map((rp: any) => ({
            id: rp.id,
            idTrip: rp.idTrip,
            name: rp.name,
            latitude: Number(rp.latitude),
            longitude: Number(rp.longitude),
            order: rp.order,
          }))
        : undefined,
      galleryImages: prismaTrip.galleryImages
        ? prismaTrip.galleryImages.map((gi: any) => ({
            id: gi.id,
            idTrip: gi.idTrip,
            imageUrl: gi.imageUrl,
            order: gi.order,
          }))
        : undefined,
      itineraryDays: prismaTrip.itineraryDays
        ? prismaTrip.itineraryDays.map((day: any) => ({
            id: day.id,
            idTrip: day.idTrip,
            day: day.day,
            title: day.title,
            subtitle: day.subtitle,
            order: day.order,
            activities: day.activities.map((act: any) => ({
              id: act.id,
              idDay: act.idDay,
              type: act.type,
              title: act.title,
              description: act.description,
              time: act.time,
              imageUrl: act.imageUrl,
              latitude: act.latitude ? Number(act.latitude) : undefined,
              longitude: act.longitude ? Number(act.longitude) : undefined,
              poiId: act.poiId,
              order: act.order,
            })),
          }))
        : undefined,
    });
  }
}
