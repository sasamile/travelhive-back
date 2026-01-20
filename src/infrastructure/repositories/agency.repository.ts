import { Injectable } from '@nestjs/common';
import {
  IAgencyRepository,
  IAgencyMemberRepository,
} from '../../domain/ports/agency.repository.port';
import { Agency } from '../../domain/entities/agency.entity';
import { AgencyMember } from '../../domain/entities/agency-member.entity';
import { PrismaService } from '../database/prisma/prisma.service';

@Injectable()
export class AgencyRepository implements IAgencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(agency: Partial<Agency>): Promise<Agency> {
    const created = await this.prisma.agency.create({
      data: {
        nameAgency: agency.nameAgency!,
        email: agency.email,
        phone: agency.phone,
        nit: agency.nit,
        rntNumber: agency.rntNumber,
        picture: agency.picture,
        status: agency.status || 'active',
        approvalStatus: agency.approvalStatus || 'PENDING',
      },
    });
    return this.mapToEntity(created);
  }

  async findById(id: bigint): Promise<Agency | null> {
    const agency = await this.prisma.agency.findUnique({
      where: { idAgency: id },
    });
    return agency ? this.mapToEntity(agency) : null;
  }

  async findByNit(nit: string): Promise<Agency | null> {
    const agency = await this.prisma.agency.findFirst({
      where: { nit },
    });
    return agency ? this.mapToEntity(agency) : null;
  }

  async findByRntNumber(rntNumber: string): Promise<Agency | null> {
    const agency = await this.prisma.agency.findFirst({
      where: { rntNumber },
    });
    return agency ? this.mapToEntity(agency) : null;
  }

  async update(id: bigint, data: Partial<Agency>): Promise<Agency> {
    const updated = await this.prisma.agency.update({
      where: { idAgency: id },
      data: {
        ...(data.nameAgency && { nameAgency: data.nameAgency }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.picture !== undefined && { picture: data.picture }),
        ...(data.status && { status: data.status }),
        ...(data.approvalStatus && { approvalStatus: data.approvalStatus }),
        ...(data.rejectionReason !== undefined && { rejectionReason: data.rejectionReason }),
        ...(data.reviewedBy !== undefined && { reviewedBy: data.reviewedBy }),
        ...(data.reviewedAt !== undefined && { reviewedAt: data.reviewedAt }),
      },
    });
    return this.mapToEntity(updated);
  }

  async updateApprovalStatus(id: bigint, status: string, reviewedBy: string, rejectionReason?: string): Promise<Agency> {
    const updated = await this.prisma.agency.update({
      where: { idAgency: id },
      data: {
        approvalStatus: status as any,
        reviewedBy,
        reviewedAt: new Date(),
        ...(rejectionReason && { rejectionReason }),
      },
    });
    return this.mapToEntity(updated);
  }

  async findPendingAgencies(): Promise<Agency[]> {
    const agencies = await this.prisma.agency.findMany({
      where: { approvalStatus: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    return agencies.map((a) => this.mapToEntity(a));
  }

  async findUserApprovedAgencies(userId: string): Promise<Agency[]> {
    const agencies = await this.prisma.agency.findMany({
      where: {
        agencyMembers: {
          some: {
            idUser: userId,
          },
        },
        approvalStatus: 'APPROVED',
      },
    });
    return agencies.map((a) => this.mapToEntity(a));
  }

  private mapToEntity(prismaAgency: any): Agency {
    return new Agency({
      idAgency: prismaAgency.idAgency,
      nameAgency: prismaAgency.nameAgency,
      email: prismaAgency.email,
      phone: prismaAgency.phone,
      nit: prismaAgency.nit,
      rntNumber: prismaAgency.rntNumber,
      picture: prismaAgency.picture,
      status: prismaAgency.status,
      approvalStatus: prismaAgency.approvalStatus,
      rejectionReason: prismaAgency.rejectionReason,
      reviewedBy: prismaAgency.reviewedBy,
      reviewedAt: prismaAgency.reviewedAt,
      createdAt: prismaAgency.createdAt,
      updatedAt: prismaAgency.updatedAt,
    });
  }
}

@Injectable()
export class AgencyMemberRepository implements IAgencyMemberRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(member: Partial<AgencyMember>): Promise<AgencyMember> {
    const created = await this.prisma.agencyMember.create({
      data: {
        idAgency: BigInt(member.idAgency!.toString()),
        idUser: member.idUser as string,
        role: member.role!,
      },
    });
    return this.mapToEntity(created);
  }

  async findUserAgencies(userId: string): Promise<AgencyMember[]> {
    const members = await this.prisma.agencyMember.findMany({
      where: { idUser: userId },
    });
    return members.map((m) => this.mapToEntity(m));
  }

  async findAgencyMembers(agencyId: bigint): Promise<AgencyMember[]> {
    const members = await this.prisma.agencyMember.findMany({
      where: { idAgency: agencyId },
    });
    return members.map((m) => this.mapToEntity(m));
  }

  async findByAgencyAndUser(
    agencyId: bigint,
    userId: string,
  ): Promise<AgencyMember | null> {
    const member = await this.prisma.agencyMember.findUnique({
      where: {
        idAgency_idUser: {
          idAgency: agencyId,
          idUser: userId,
        },
      },
    });
    return member ? this.mapToEntity(member) : null;
  }

  async updateRole(id: bigint, role: string): Promise<AgencyMember> {
    const updated = await this.prisma.agencyMember.update({
      where: { id },
      data: { role },
    });
    return this.mapToEntity(updated);
  }

  private mapToEntity(prismaMember: any): AgencyMember {
    return new AgencyMember({
      id: prismaMember.id,
      idAgency: prismaMember.idAgency,
      idUser: prismaMember.idUser,
      role: prismaMember.role,
      createdAt: prismaMember.createdAt,
      updatedAt: prismaMember.updatedAt,
    });
  }
}
