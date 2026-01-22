import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { BookingItemType } from '@prisma/client';

export interface CreateBookingInput {
  userId: string;
  idTrip: bigint;
  idExpedition: bigint;
  adults: number;
  children: number;
  discountCode?: string;
}

@Injectable()
export class CreateBookingUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: CreateBookingInput) {
    const seats = input.adults + input.children;
    if (seats <= 0) {
      throw new BadRequestException('Debes comprar al menos 1 cupo (adultos o niños)');
    }

    return this.prisma.$transaction(async (tx) => {
      const expedition = await tx.expedition.findUnique({
        where: { idExpedition: input.idExpedition },
        include: { trip: true },
      });

      if (!expedition || expedition.idTrip !== input.idTrip) {
        throw new NotFoundException('Expedición no encontrada para ese trip');
      }

      if (expedition.status !== 'AVAILABLE') {
        throw new BadRequestException('La expedición no está disponible para compras');
      }

      // Trip debe estar publicado y activo para poder comprar
      if (expedition.trip.status !== 'PUBLISHED' || expedition.trip.isActive !== true) {
        throw new BadRequestException('Este trip no está disponible para compra');
      }

      // Decremento atómico de cupos (evita oversell)
      const updatedExpedition = await tx.expedition.update({
        where: { idExpedition: input.idExpedition },
        data: { capacityAvailable: { decrement: seats } },
      });

      if (updatedExpedition.capacityAvailable < 0) {
        // revertimos forzando error para rollback
        throw new BadRequestException('No hay cupos suficientes');
      }

      const priceAdult = expedition.priceAdult;
      const priceChild = expedition.priceChild ?? expedition.priceAdult;

      // Prisma Decimal soporta multiplicación usando string/number, pero para evitar problemas,
      // calculamos usando JS number y dejamos que Prisma haga cast.
      const subtotalNumber = input.adults * Number(priceAdult) + input.children * Number(priceChild);

      // Descuento básico (sin límites) - si existe código activo aplicable
      let discountAmountNumber = 0;
      let appliedCode: string | undefined;

      if (input.discountCode) {
        const code = await tx.discountCode.findUnique({
          where: { codeName: input.discountCode },
        });
        if (!code || !code.active) {
          throw new BadRequestException('Código de descuento inválido');
        }

        // Validación de scope: si tiene idTrip/idExpedition/idAgency, debe coincidir
        if (code.idTrip && code.idTrip !== expedition.idTrip) {
          throw new BadRequestException('Código de descuento no aplica a este trip');
        }
        if (code.idExpedition && code.idExpedition !== expedition.idExpedition) {
          throw new BadRequestException('Código de descuento no aplica a esta expedición');
        }
        if (code.idAgency && code.idAgency !== expedition.trip.idAgency) {
          throw new BadRequestException('Código de descuento no aplica a esta agencia');
        }

        appliedCode = code.codeName;
        if (code.discountType === 'PERCENTAGE') {
          discountAmountNumber = subtotalNumber * (Number(code.value) / 100);
        } else {
          discountAmountNumber = Number(code.value);
        }

        // cap no negativo
        discountAmountNumber = Math.min(discountAmountNumber, subtotalNumber);
      }

      const serviceFeeNumber = 0;
      const totalNumber = subtotalNumber + serviceFeeNumber - discountAmountNumber;

      const booking = await tx.booking.create({
        data: {
          idExpedition: expedition.idExpedition,
          idTrip: expedition.idTrip,
          idAgency: expedition.trip.idAgency,
          ownerBuy: input.userId,
          status: 'CONFIRMED', // por ahora confirmamos directo (sin PSP)
          subtotal: subtotalNumber,
          serviceFee: serviceFeeNumber,
          discountCode: appliedCode,
          discountAmount: discountAmountNumber,
          totalBuy: totalNumber,
          currency: expedition.currency,
          bookingItems: {
            create: [
              ...(input.adults > 0
                ? [
                    {
                      itemType: BookingItemType.ADULT,
                      description: 'Adulto',
                      quantity: input.adults,
                      unitPrice: priceAdult,
                      totalPrice: input.adults * Number(priceAdult),
                    },
                  ]
                : []),
              ...(input.children > 0
                ? [
                    {
                      itemType: BookingItemType.CHILD,
                      description: 'Niño',
                      quantity: input.children,
                      unitPrice: priceChild,
                      totalPrice: input.children * Number(priceChild),
                    },
                  ]
                : []),
            ],
          },
        },
        include: {
          bookingItems: {
            select: {
              id: true,
              itemType: true,
              description: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
            },
          },
        },
      });

      // si aplicamos descuento, increment usage counters básicos
      if (appliedCode) {
        const code = await tx.discountCode.findUnique({ where: { codeName: appliedCode } });
        if (code) {
          await tx.discountCode.update({
            where: { id: code.id },
            data: { usedCount: { increment: 1 } },
          });
          await tx.discountCodeUsage.create({
            data: {
              discountCodeId: code.id,
              userId: input.userId,
              bookingId: booking.idBooking,
            },
          });
        }
      }

      return {
        idBooking: booking.idBooking.toString(),
        status: booking.status,
        totalBuy: booking.totalBuy,
        currency: booking.currency,
        bookingItems: booking.bookingItems.map((i) => ({
          id: i.id.toString(),
          itemType: i.itemType,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
        })),
      };
    });
  }
}
