import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { BookingItemType } from '@prisma/client';
import { WompiService } from '../../../config/payments/wompi.service';

export interface CreateBookingInput {
  userId: string;
  userEmail: string;
  idTrip: bigint;
  idExpedition: bigint;
  adults: number;
  children: number;
  discountCode?: string;
  redirectUrl?: string; // URL a la que Wompi redirige después del pago
}

@Injectable()
export class CreateBookingUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wompiService: WompiService,
  ) {}

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

      // Crear booking con status PENDING (se confirmará cuando Wompi confirme el pago)
      const booking = await tx.booking.create({
        data: {
          idExpedition: expedition.idExpedition,
          idTrip: expedition.idTrip,
          idAgency: expedition.trip.idAgency,
          ownerBuy: input.userId,
          status: 'PENDING', // Pendiente hasta que Wompi confirme el pago
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

      // Generar referencia única para Wompi
      const wompiReference = this.wompiService.generateReference(booking.idBooking.toString());

      // Construir redirectUrl: si no se proporciona, usar el por defecto con la referencia
      // Wompi agregará automáticamente el parámetro 'id' con el transaction ID
      // NOTA: En sandbox, Wompi puede bloquear localhost. Si hay problemas, usar una URL pública o omitir redirectUrl
      const redirectUrl =
        input.redirectUrl ||
        (process.env.FRONTEND_URL
          ? `${process.env.FRONTEND_URL}/customers/trip?reference=${encodeURIComponent(wompiReference)}&bookingId=${booking.idBooking.toString()}`
          : `https://187c24719bf7.ngrok-free.app/customers/trip?reference=${encodeURIComponent(wompiReference)}&bookingId=${booking.idBooking.toString()}`);

      // Generar link de pago (Web Checkout). La transacción se crea cuando el usuario paga en Wompi.
      const wompiPaymentLink = this.wompiService.buildCheckoutLink({
        amount: totalNumber,
        currency: expedition.currency,
        customerEmail: input.userEmail,
        reference: wompiReference,
        redirectUrl,
      });

      // Guardar referencia para trazabilidad (transactionId se obtiene luego desde el redirect o verificación)
      await tx.booking.update({
        where: { idBooking: booking.idBooking },
        data: {
          referenceBuy: wompiReference,
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
        wompiPaymentLink,
        wompiReference,
        bookingItems: booking.bookingItems.map((i) => ({
          id: i.id.toString(),
          itemType: i.itemType,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
        })),
        expedition: {
          idExpedition: updatedExpedition.idExpedition.toString(),
          startDate: updatedExpedition.startDate.toISOString(),
          endDate: updatedExpedition.endDate.toISOString(),
          capacityAvailable: updatedExpedition.capacityAvailable,
        },
      };
    });
  }
}
