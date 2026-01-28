import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

export interface ListAllAgenciesInput {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
  page?: number;
  limit?: number;
}

@Injectable()
export class ListAllAgenciesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListAllAgenciesInput = {}) {
    const page = input.page || 1;
    const limit = input.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (input.status && input.status !== 'ALL') {
      where.approvalStatus = input.status;
    }

    const [agencies, total] = await Promise.all([
      this.prisma.agency.findMany({
        where,
        include: {
          agencyMembers: {
            select: {
              idUser: true,
              role: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.agency.count({ where }),
    ]);

    return {
      data: agencies.map((agency) => ({
        idAgency: agency.idAgency.toString(),
        nameAgency: agency.nameAgency,
        email: agency.email,
        phone: agency.phone,
        nit: agency.nit,
        rntNumber: agency.rntNumber,
        picture: agency.picture,
        status: agency.status,
        approvalStatus: agency.approvalStatus,
        rejectionReason: agency.rejectionReason,
        reviewedBy: agency.reviewedBy,
        reviewedAt: agency.reviewedAt,
        createdAt: agency.createdAt,
        updatedAt: agency.updatedAt,
        members: agency.agencyMembers.map((member) => ({
          userId: member.idUser,
          role: member.role,
          user: {
            id: member.user.id,
            name: member.user.name,
            email: member.user.email,
          },
        })),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      counts: {
        pending: await this.prisma.agency.count({ where: { approvalStatus: 'PENDING' } }),
        approved: await this.prisma.agency.count({ where: { approvalStatus: 'APPROVED' } }),
        rejected: await this.prisma.agency.count({ where: { approvalStatus: 'REJECTED' } }),
        all: await this.prisma.agency.count(),
      },
    };
  }
}
