import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { BookingItemType } from '@prisma/client';
import { WompiService } from '../../../config/payments/wompi.service';

export interface CreateBookingFromTripInput {
  userId: string;
  userEmail: string;
  idTrip: bigint;
  startDate: Date;
  endDate: Date;
  adults: number;
  children: number;
  discountCode?: string;
  redirectUrl?: string;
}

@Injectable()
export class CreateBookingFromTripUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wompiService: WompiService,
  ) {}

  async execute(input: CreateBookingFromTripInput) {
    const seats = input.adults + input.children;
    if (seats <= 0) {
      throw new BadRequestException('Debes comprar al menos 1 cupo (adultos o niños)');
    }

    // Validar que las fechas sean válidas
    if (input.startDate >= input.endDate) {
      throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin');
    }

    return this.prisma.$transaction(async (tx) => {
      // Obtener el trip con toda su información
      const trip = await tx.trip.findUnique({
        where: { idTrip: input.idTrip },
        include: { agency: true },
      });

      if (!trip) {
        throw new NotFoundException('Viaje no encontrado');
      }

      // Verificar que el trip esté publicado y activo
      if (trip.status !== 'PUBLISHED' || trip.isActive !== true) {
        throw new BadRequestException('Este viaje no está disponible para compra');
      }

      // Validar que las fechas estén dentro del rango del trip (si tiene fechas definidas)
      if (trip.startDate && trip.endDate) {
        const tripStart = new Date(trip.startDate);
        const tripEnd = new Date(trip.endDate);
        if (input.startDate < tripStart || input.endDate > tripEnd) {
          throw new BadRequestException(
            `Las fechas deben estar entre ${tripStart.toISOString().split('T')[0]} y ${tripEnd.toISOString().split('T')[0]}`,
          );
        }
      }

      // Validar capacidad máxima (si tiene maxPersons)
      if (trip.maxPersons && seats > trip.maxPersons) {
        throw new BadRequestException(`El viaje tiene capacidad máxima de ${trip.maxPersons} personas`);
      }

      // Buscar si ya existe una expedición para estas fechas
      let expedition = await tx.expedition.findFirst({
        where: {
          idTrip: input.idTrip,
          startDate: input.startDate,
          endDate: input.endDate,
          status: 'AVAILABLE',
        },
      });

      // Si no existe expedición, crear una automáticamente
      if (!expedition) {
        // Calcular capacidad total basada en maxPersons del trip o un valor por defecto
        const capacityTotal = trip.maxPersons || 20; // Valor por defecto si no tiene maxPersons

        // Calcular precios (usar precio del trip o valores por defecto)
        const priceAdult = trip.price ? Number(trip.price) : 100; // Valor por defecto
        const priceChild = trip.price ? Number(trip.price) * 0.7 : 70; // 70% del precio adulto
        const currency = trip.currency || 'USD';

        // Verificar si hay cupos disponibles (contar reservas existentes para estas fechas)
        const existingBookings = await tx.booking.findMany({
          where: {
            idTrip: input.idTrip,
            status: {
              in: ['PENDING', 'CONFIRMED'],
            },
            expedition: {
              startDate: input.startDate,
              endDate: input.endDate,
            },
          },
          include: {
            bookingItems: true,
          },
        });

        const bookedSeats = existingBookings.reduce((total, booking) => {
          return (
            total +
            booking.bookingItems.reduce((sum, item) => sum + item.quantity, 0)
          );
        }, 0);

        const capacityAvailable = capacityTotal - bookedSeats;

        if (capacityAvailable < seats) {
          throw new BadRequestException(
            `No hay cupos suficientes. Disponibles: ${capacityAvailable}, Solicitados: ${seats}`,
          );
        }

        // Crear la expedición automáticamente
        expedition = await tx.expedition.create({
          data: {
            idTrip: input.idTrip,
            startDate: input.startDate,
            endDate: input.endDate,
            capacityTotal,
            capacityAvailable,
            priceAdult,
            priceChild,
            currency,
            status: 'AVAILABLE',
          },
        });
      }

      // Verificar que la expedición tenga cupos suficientes
      if (expedition.capacityAvailable < seats) {
        throw new BadRequestException('No hay cupos suficientes en esta fecha');
      }

      if (expedition.status !== 'AVAILABLE') {
        throw new BadRequestException('Esta fecha no está disponible para compras');
      }

      // Decremento atómico de cupos (evita oversell)
      const updatedExpedition = await tx.expedition.update({
        where: { idExpedition: expedition.idExpedition },
        data: { capacityAvailable: { decrement: seats } },
      });

      if (updatedExpedition.capacityAvailable < 0) {
        // revertimos forzando error para rollback
        throw new BadRequestException('No hay cupos suficientes');
      }

      const priceAdult = expedition.priceAdult;
      const priceChild = expedition.priceChild ?? expedition.priceAdult;

      // Calcular subtotal
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
        if (code.idTrip && code.idTrip !== trip.idTrip) {
          throw new BadRequestException('Código de descuento no aplica a este viaje');
        }
        if (code.idExpedition && code.idExpedition !== expedition.idExpedition) {
          throw new BadRequestException('Código de descuento no aplica a esta fecha');
        }
        if (code.idAgency && code.idAgency !== trip.idAgency) {
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
          idTrip: trip.idTrip,
          idAgency: trip.idAgency,
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

      // Generar link de pago (Web Checkout). La transacción se crea cuando el usuario paga en Wompi.
      const wompiPaymentLink = this.wompiService.buildCheckoutLink({
        amount: totalNumber,
        currency: expedition.currency,
        customerEmail: input.userEmail,
        reference: wompiReference,
        redirectUrl: input.redirectUrl,
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
        trip: {
          idTrip: trip.idTrip.toString(),
          title: trip.title,
        },
      };
    });
  }
}
