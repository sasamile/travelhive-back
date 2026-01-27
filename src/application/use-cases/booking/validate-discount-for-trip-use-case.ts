import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

export interface ValidateDiscountForTripInput {
  userId: string;
  idTrip: bigint;
  startDate?: Date;
  endDate?: Date;
  adults: number;
  children: number;
  discountCode: string;
}

@Injectable()
export class ValidateDiscountForTripUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ValidateDiscountForTripInput) {
    const seats = input.adults + input.children;
    if (seats <= 0) {
      throw new BadRequestException('Debes comprar al menos 1 cupo (adultos o niños)');
    }

    // Obtener el trip
    const trip = await this.prisma.trip.findUnique({
      where: { idTrip: input.idTrip },
      include: { agency: true },
    });

    if (!trip) {
      throw new NotFoundException('Viaje no encontrado');
    }

    if (trip.status !== 'PUBLISHED' || trip.isActive !== true) {
      throw new BadRequestException('Este viaje no está disponible para compra');
    }

    // Validar que las fechas estén dentro del rango del trip (si tiene fechas definidas)
    if (input.startDate && input.endDate) {
      if (input.startDate >= input.endDate) {
        throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin');
      }

      if (trip.startDate && trip.endDate) {
        const tripStart = new Date(trip.startDate);
        const tripEnd = new Date(trip.endDate);
        if (input.startDate < tripStart || input.endDate > tripEnd) {
          throw new BadRequestException(
            `Las fechas deben estar entre ${tripStart.toISOString().split('T')[0]} y ${tripEnd.toISOString().split('T')[0]}`,
          );
        }
      }
    }

    // Cargar el código de descuento
    const code = await this.prisma.discountCode.findUnique({
      where: { codeName: input.discountCode },
    });

    if (!code || !code.active) {
      throw new BadRequestException('Código de descuento inválido');
    }

    // Validación de scope: si tiene idTrip/idExpedition/idAgency, debe coincidir
    if (code.idTrip && code.idTrip !== trip.idTrip) {
      throw new BadRequestException('Código de descuento no aplica a este viaje');
    }
    if (code.idAgency && code.idAgency !== trip.idAgency) {
      throw new BadRequestException('Código de descuento no aplica a esta agencia');
    }

    // Reglas de cupo del código
    if (code.maxUses !== null && code.maxUses !== undefined && code.usedCount >= code.maxUses) {
      throw new BadRequestException('Este código de descuento ya no tiene cupo disponible');
    }

    // Límite por usuario (global)
    if (code.perUserLimit !== null && code.perUserLimit !== undefined) {
      const userUsageCount = await this.prisma.discountCodeUsage.count({
        where: {
          discountCodeId: code.id,
          userId: input.userId,
        },
      });

      if (userUsageCount >= code.perUserLimit) {
        throw new BadRequestException('Ya has usado el máximo permitido de este código de descuento');
      }
    }

    // Regla adicional: un mismo usuario no puede usar más de un código
    // de descuento en el mismo viaje (sin importar cuál código sea).
    const existingBookingWithDiscountForTrip = await this.prisma.booking.findFirst({
      where: {
        ownerBuy: input.userId,
        idTrip: trip.idTrip,
        discountCode: {
          not: null,
        },
      },
    });

    if (existingBookingWithDiscountForTrip) {
      throw new BadRequestException('Solo puedes usar un código de descuento por viaje');
    }

    // Determinar precios base igual que en CreateBookingFromTripUseCase
    const priceAdult = trip.price ? Number(trip.price) : 100;
    const priceChild = trip.price ? Number(trip.price) * 0.7 : 70;
    const currency = trip.currency || 'USD';

    const subtotalNumber = input.adults * priceAdult + input.children * priceChild;

    let discountAmountNumber = 0;

    if (code.discountType === 'PERCENTAGE') {
      discountAmountNumber = subtotalNumber * (Number(code.value) / 100);
    } else {
      discountAmountNumber = Number(code.value);
    }

    // cap no negativo
    discountAmountNumber = Math.min(discountAmountNumber, subtotalNumber);

    const serviceFeeNumber = 0;
    const totalNumber = subtotalNumber + serviceFeeNumber - discountAmountNumber;

    return {
      isValid: true,
      code: code.codeName,
      originalSubtotal: subtotalNumber,
      discountAmount: discountAmountNumber,
      total: totalNumber,
      currency,
      seats,
    };
  }
}

