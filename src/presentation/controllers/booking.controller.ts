import { Controller, Get, Post, Param, Body, Session, HttpCode, HttpStatus, NotFoundException, BadRequestException, Query, Logger } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { CreateBookingUseCase } from '../../application/use-cases/booking/create-booking-use-case';
import { CreateBookingFromTripUseCase } from '../../application/use-cases/booking/create-booking-from-trip-use-case';
import { ListMyBookingsUseCase } from '../../application/use-cases/booking/list-my-bookings-use-case';
import { UpdateBookingPaymentUseCase } from '../../application/use-cases/booking/update-booking-payment-use-case';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { CreateBookingFromTripDto } from '../dto/create-booking-from-trip.dto';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { WompiService } from '../../config/payments/wompi.service';
import { ValidateDiscountForTripUseCase } from '../../application/use-cases/booking/validate-discount-for-trip-use-case';
import { ValidateDiscountDto } from '../dto/validate-discount.dto';
import { QRCodeService } from '../../application/services/qr-code.service';

@Controller('bookings')
export class BookingController {
  private readonly logger = new Logger(BookingController.name);

  constructor(
    private readonly createBookingUseCase: CreateBookingUseCase,
    private readonly createBookingFromTripUseCase: CreateBookingFromTripUseCase,
    private readonly listMyBookingsUseCase: ListMyBookingsUseCase,
    private readonly updateBookingPaymentUseCase: UpdateBookingPaymentUseCase,
    private readonly prisma: PrismaService,
    private readonly wompiService: WompiService,
    private readonly validateDiscountForTripUseCase: ValidateDiscountForTripUseCase,
    private readonly qrCodeService: QRCodeService,
  ) {}

  /**
   * Crear una nueva reserva desde un viaje (trip)
   * Crea automáticamente la expedición si no existe y genera link de pago de Wompi
   * Este es el endpoint principal para reservar desde el frontend
   */
  @Post('from-trip')
  @HttpCode(HttpStatus.CREATED)
  async createBookingFromTrip(@Session() session: UserSession, @Body() dto: CreateBookingFromTripDto) {
    const booking = await this.createBookingFromTripUseCase.execute({
      userId: session.user.id,
      userEmail: session.user.email,
      idTrip: BigInt(dto.idTrip),
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      adults: dto.adults,
      children: dto.children,
      discountCode: dto.discountCode,
      promoterCode: dto.promoterCode,
      redirectUrl: dto.redirectUrl,
    });

    return { message: 'Reserva creada exitosamente', data: booking };
  }

  /**
   * Validar un código de descuento para un viaje específico antes de crear la reserva.
   * - Verifica que el código exista y esté activo
   * - Verifica cupo global del código (maxUses)
   * - Verifica límite por usuario (perUserLimit)
   * - Verifica que el usuario no tenga ya una reserva con algún código de descuento para ese viaje
   * - Calcula el subtotal, el descuento y el total estimado
   */
  @Post('validate-discount')
  @HttpCode(HttpStatus.OK)
  async validateDiscountForTrip(@Session() session: UserSession, @Body() dto: ValidateDiscountDto) {
    const result = await this.validateDiscountForTripUseCase.execute({
      userId: session.user.id,
      idTrip: BigInt(dto.idTrip),
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      adults: dto.adults,
      children: dto.children,
      discountCode: dto.discountCode,
    });

    return {
      message: 'Código de descuento válido',
      data: result,
    };
  }

  /**
   * Crear una nueva reserva desde una expedición existente
   * Requiere que la expedición ya esté creada
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createBooking(@Session() session: UserSession, @Body() dto: CreateBookingDto) {
    const booking = await this.createBookingUseCase.execute({
      userId: session.user.id,
      userEmail: session.user.email,
      idTrip: BigInt(dto.idTrip),
      idExpedition: BigInt(dto.idExpedition),
      adults: dto.adults,
      children: dto.children,
      discountCode: dto.discountCode,
      promoterCode: dto.promoterCode,
      redirectUrl: dto.redirectUrl,
    });

    return { message: 'Reserva creada exitosamente', data: booking };
  }

  /**
   * Listar mis reservas como cliente/viajero
   * Permite filtrar por:
   * - filter: 'all' | 'upcoming' | 'history' (próximos o historial)
   * - search: nombre del viaje para buscar
   * 
   * Ejemplos:
   * GET /bookings?filter=upcoming - Solo próximos viajes
   * GET /bookings?filter=history - Solo historial
   * GET /bookings?search=islandia - Buscar por nombre
   * GET /bookings?filter=upcoming&search=aventura - Próximos que contengan "aventura"
   */
  @Get()
  async listMyBookings(
    @Session() session: UserSession,
    @Query('filter') filter?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.listMyBookingsUseCase.execute({
      userId: session.user.id,
      filter: filter as any,
      search,
    });
    return {
      bookings: result.data,
      upcoming: result.upcoming,
      history: result.history,
      total: result.total,
      upcomingCount: result.upcomingCount,
      historyCount: result.historyCount,
    };
  }

  /**
   * Obtener una reserva específica
   */
  @Get(':id')
  async getBooking(@Session() session: UserSession, @Param('id') id: string) {
    const bookingId = BigInt(id);

    const booking = await this.prisma.booking.findUnique({
      where: { idBooking: bookingId },
      include: {
        bookingItems: true,
        expedition: {
          select: {
            idExpedition: true,
            startDate: true,
            endDate: true,
            capacityAvailable: true,
          },
        },
        trip: {
          select: {
            idTrip: true,
            title: true,
            description: true,
            coverImage: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Reserva no encontrada');
    }

    // Verificar que la reserva pertenece al usuario
    if (booking.ownerBuy !== session.user.id) {
      throw new NotFoundException('Reserva no encontrada');
    }

    return {
      idBooking: booking.idBooking.toString(),
      status: booking.status,
      totalBuy: booking.totalBuy,
      currency: booking.currency,
      subtotal: booking.subtotal,
      serviceFee: booking.serviceFee,
      discountAmount: booking.discountAmount,
      discountCode: booking.discountCode,
      dateBuy: booking.dateBuy,
      transactionId: booking.transactionId,
      paymentSource: booking.paymentSource,
      expedition: {
        idExpedition: booking.expedition.idExpedition.toString(),
        startDate: booking.expedition.startDate.toISOString(),
        endDate: booking.expedition.endDate.toISOString(),
        capacityAvailable: booking.expedition.capacityAvailable,
      },
      trip: {
        idTrip: booking.trip.idTrip.toString(),
        title: booking.trip.title,
        description: booking.trip.description,
        coverImage: booking.trip.coverImage,
      },
      bookingItems: booking.bookingItems.map((item) => ({
        id: item.id.toString(),
        itemType: item.itemType,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
    };
  }

  /**
   * Verificar y actualizar el estado del pago de una reserva
   * Consulta el estado en Wompi y actualiza el booking si es necesario
   * 
   * Puede recibir:
   * - transactionId: ID de la transacción de Wompi (desde redirect o manual)
   * - reference: Referencia de Wompi (útil si el redirect no funciona)
   */
  @Post(':id/verify-payment')
  async verifyPayment(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Query('transactionId') transactionIdQuery?: string,
    @Query('id') wompiRedirectIdQuery?: string,
    @Query('reference') referenceQuery?: string,
    @Body() body?: { transactionId?: string; reference?: string },
  ) {
    const bookingId = BigInt(id);

    const booking = await this.prisma.booking.findUnique({
      where: { idBooking: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Reserva no encontrada');
    }

    // Verificar que la reserva pertenece al usuario
    if (booking.ownerBuy !== session.user.id) {
      throw new NotFoundException('Reserva no encontrada');
    }

    const providedTransactionId = body?.transactionId || transactionIdQuery || wompiRedirectIdQuery;
    const providedReference = body?.reference || referenceQuery || booking.referenceBuy;

    // Si aún no tenemos transactionId guardado, intentar obtenerlo
    if (!booking.transactionId) {
      if (providedTransactionId) {
        // Si viene el transactionId directamente, guardarlo
        await this.prisma.booking.update({
          where: { idBooking: bookingId },
          data: { transactionId: providedTransactionId },
        });
        booking.transactionId = providedTransactionId;
      } else if (providedReference) {
        // Si no hay transactionId pero tenemos la referencia, buscar la transacción en Wompi
        try {
          const wompiResponse = await this.wompiService.getTransactionByReference(providedReference);
          if (wompiResponse && wompiResponse.data.id) {
            await this.prisma.booking.update({
              where: { idBooking: bookingId },
              data: { transactionId: wompiResponse.data.id },
            });
            booking.transactionId = wompiResponse.data.id;
          }
        } catch (error: any) {
          this.logger.warn(`No se pudo obtener transactionId desde referencia: ${providedReference}`);
        }
      }
    }

    // Si aún no tiene transactionId, no se puede verificar
    if (!booking.transactionId) {
      throw new BadRequestException(
        'Esta reserva no tiene una transacción de Wompi asociada. Envía transactionId o reference (que aparece en la página de confirmación de Wompi).',
      );
    }

    // Si ya está confirmada, retornar directamente con el QR si existe
    if (booking.status === 'CONFIRMED') {
      const existingQR = await this.prisma.bookingQR.findUnique({
        where: { idBooking: bookingId },
      });

      return {
        idBooking: booking.idBooking.toString(),
        status: booking.status,
        message: 'Reserva ya está confirmada',
        qrCode: existingQR?.qrCode || null,
        qrImageUrl: existingQR?.qrImageUrl || null,
      };
    }

    try {
      // Consultar el estado de la transacción en Wompi
      const wompiResponse = await this.wompiService.getTransaction(booking.transactionId);
      const transactionStatus = wompiResponse.data.status;

      // Mapear estados de Wompi
      let bookingStatus: 'APPROVED' | 'DECLINED' | 'VOIDED' = 'DECLINED';

      if (transactionStatus === 'APPROVED') {
        bookingStatus = 'APPROVED';
      } else if (transactionStatus === 'VOIDED') {
        bookingStatus = 'VOIDED';
      } else {
        bookingStatus = 'DECLINED';
      }

      // Actualizar el estado del booking
      const result = await this.updateBookingPaymentUseCase.execute({
        bookingId,
        transactionId: booking.transactionId,
        status: bookingStatus,
        paymentSource: wompiResponse.data.payment_method?.type || 'UNKNOWN',
      });

      return {
        idBooking: result.idBooking,
        status: result.status,
        message: result.message,
        wompiStatus: transactionStatus,
        qrCode: result.qrCode || null,
        qrImageUrl: result.qrImageUrl || null,
      };
    } catch (error: any) {
      throw new BadRequestException(`Error al verificar el pago: ${error.message}`);
    }
  }

  /**
   * Escanear un código QR para verificar entrada
   * Endpoint para guardia de seguridad (público, no requiere autenticación)
   * Muestra información completa de la reserva, viaje y personas
   */
  @Get('qr/:qrCode')
  @AllowAnonymous()
  async scanQR(@Param('qrCode') qrCode: string) {
    const qrInfo = await this.qrCodeService.getQRInfo(qrCode);

    if (!qrInfo) {
      throw new NotFoundException('Código QR no encontrado');
    }

    if (!qrInfo.valid) {
      return {
        valid: false,
        error: qrInfo.error,
        data: null,
      };
    }

    return {
      valid: true,
      data: qrInfo,
    };
  }

  /**
   * Marcar un código QR como reclamado/usado
   * Endpoint para guardia de seguridad
   * Previene fraudes marcando el QR como usado
   */
  @Post('qr/:qrCode/claim')
  @HttpCode(HttpStatus.OK)
  async claimQR(
    @Param('qrCode') qrCode: string,
    @Session() session?: UserSession,
  ) {
    const result = await this.qrCodeService.claimQR(
      qrCode,
      session?.user?.id, // ID del guardia que marca como reclamado (opcional)
    );

    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    return {
      success: true,
      message: result.message,
    };
  }
}
