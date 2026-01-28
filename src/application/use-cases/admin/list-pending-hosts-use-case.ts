import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

export interface ListPendingHostsInput {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
  page?: number;
  limit?: number;
}

@Injectable()
export class ListPendingHostsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListPendingHostsInput = {}) {
    const page = input.page || 1;
    const limit = input.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      isHost: true,
    };

    if (input.status && input.status !== 'ALL') {
      where.hostApprovalStatus = input.status;
    } else if (!input.status) {
      // Por defecto, mostrar solo pendientes si no se especifica
      where.hostApprovalStatus = 'PENDING';
    }

    const [hosts, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phoneUser: true,
          dniUser: true,
          city: true,
          department: true,
          image: true,
          isHost: true,
          hostApprovalStatus: true,
          hostRejectionReason: true,
          hostReviewedBy: true,
          hostReviewedAt: true,
          createdAt: true,
          updatedAt: true,
          trips: {
            select: {
              idTrip: true,
              title: true,
              status: true,
              createdAt: true,
            },
            take: 5, // Solo las primeras 5 experiencias
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: hosts.map((host) => ({
        id: host.id,
        name: host.name,
        email: host.email,
        phone: host.phoneUser,
        dni: host.dniUser,
        city: host.city,
        department: host.department,
        image: host.image,
        isHost: host.isHost,
        approvalStatus: host.hostApprovalStatus,
        rejectionReason: host.hostRejectionReason,
        reviewedBy: host.hostReviewedBy,
        reviewedAt: host.hostReviewedAt,
        createdAt: host.createdAt,
        updatedAt: host.updatedAt,
        experiencesCount: host.trips.length,
        recentExperiences: host.trips.map((trip) => ({
          idTrip: trip.idTrip.toString(),
          title: trip.title,
          status: trip.status,
          createdAt: trip.createdAt,
        })),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      counts: {
        pending: await this.prisma.user.count({
          where: { isHost: true, hostApprovalStatus: 'PENDING' },
        }),
        approved: await this.prisma.user.count({
          where: { isHost: true, hostApprovalStatus: 'APPROVED' },
        }),
        rejected: await this.prisma.user.count({
          where: { isHost: true, hostApprovalStatus: 'REJECTED' },
        }),
        all: await this.prisma.user.count({ where: { isHost: true } }),
      },
    };
  }
}
