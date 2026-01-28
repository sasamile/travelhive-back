import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

export interface ApproveHostInput {
  hostId: string;
  reviewedBy: string;
}

export interface RejectHostInput {
  hostId: string;
  reviewedBy: string;
  rejectionReason: string;
}

@Injectable()
export class ApproveHostUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async approve(input: ApproveHostInput) {
    const host = await this.prisma.user.findUnique({
      where: { id: input.hostId },
      select: {
        id: true,
        isHost: true,
        hostApprovalStatus: true,
      },
    });

    if (!host) {
      throw new NotFoundException('Host no encontrado');
    }

    if (!host.isHost) {
      throw new BadRequestException('Este usuario no es un host');
    }

    if (host.hostApprovalStatus === 'APPROVED') {
      throw new BadRequestException('El host ya está aprobado');
    }

    const updated = await this.prisma.user.update({
      where: { id: input.hostId },
      data: {
        hostApprovalStatus: 'APPROVED',
        hostReviewedBy: input.reviewedBy,
        hostReviewedAt: new Date(),
        hostRejectionReason: null, // Limpiar razón de rechazo si existía
      },
      select: {
        id: true,
        name: true,
        email: true,
        isHost: true,
        hostApprovalStatus: true,
        hostReviewedBy: true,
        hostReviewedAt: true,
      },
    });

    return updated;
  }

  async reject(input: RejectHostInput) {
    if (!input.rejectionReason || input.rejectionReason.trim().length === 0) {
      throw new BadRequestException('La razón de rechazo es requerida');
    }

    const host = await this.prisma.user.findUnique({
      where: { id: input.hostId },
      select: {
        id: true,
        isHost: true,
        hostApprovalStatus: true,
      },
    });

    if (!host) {
      throw new NotFoundException('Host no encontrado');
    }

    if (!host.isHost) {
      throw new BadRequestException('Este usuario no es un host');
    }

    if (host.hostApprovalStatus === 'REJECTED') {
      throw new BadRequestException('El host ya está rechazado');
    }

    const updated = await this.prisma.user.update({
      where: { id: input.hostId },
      data: {
        hostApprovalStatus: 'REJECTED',
        hostReviewedBy: input.reviewedBy,
        hostReviewedAt: new Date(),
        hostRejectionReason: input.rejectionReason,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isHost: true,
        hostApprovalStatus: true,
        hostRejectionReason: true,
        hostReviewedBy: true,
        hostReviewedAt: true,
      },
    });

    return updated;
  }
}
