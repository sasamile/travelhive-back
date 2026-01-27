import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

export interface RegisterPromoterViewInput {
  promoterCode: string;
  idTrip: bigint;
  userId?: string; // Opcional, puede ser usuario anónimo
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class RegisterPromoterViewUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: RegisterPromoterViewInput): Promise<{ registered: boolean; message: string }> {
    return this.prisma.$transaction(async (tx) => {
      // Verificar que el promoter existe y está activo
      const promoter = await tx.promoter.findUnique({
        where: { code: input.promoterCode },
      });

      if (!promoter) {
        throw new NotFoundException('Código de promoter no encontrado');
      }

      if (!promoter.isActive) {
        throw new BadRequestException('Este promoter no está activo');
      }

      // Verificar que el trip existe
      const trip = await tx.trip.findUnique({
        where: { idTrip: input.idTrip },
      });

      if (!trip) {
        throw new NotFoundException('Viaje no encontrado');
      }

      // Si hay userId, verificar que no haya registrado una vista previa para este promoter+trip
      // Si no hay userId pero hay ipAddress, también verificar por IP (menos preciso pero mejor que nada)
      const existingView = await tx.promoterView.findFirst({
        where: {
          promoterId: promoter.id,
          idTrip: input.idTrip,
          ...(input.userId
            ? { userId: input.userId }
            : input.ipAddress
              ? { ipAddress: input.ipAddress }
              : {}),
        },
      });

      // Si ya existe una vista previa, no contar de nuevo (vista única)
      if (existingView) {
        return {
          registered: false,
          message: 'Vista ya registrada anteriormente',
        };
      }

      // Registrar la nueva vista
      await tx.promoterView.create({
        data: {
          promoterId: promoter.id,
          idTrip: input.idTrip,
          userId: input.userId || null,
          ipAddress: input.ipAddress || null,
          userAgent: input.userAgent || null,
        },
      });

      // Incrementar el contador de vistas del promoter
      await tx.promoter.update({
        where: { id: promoter.id },
        data: {
          viewCount: {
            increment: 1,
          },
        },
      });

      return {
        registered: true,
        message: 'Vista registrada exitosamente',
      };
    });
  }
}
