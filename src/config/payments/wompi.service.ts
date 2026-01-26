import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface WompiTransactionRequest {
  amount_in_cents: number;
  currency: string;
  customer_email: string;
  payment_method: {
    /**
     * Wompi requiere el tipo de método de pago cuando creas transacciones vía API.
     * Nota: si usas Web Checkout/Widget, este campo no aplica (el usuario elige en el checkout).
     */
    type?: string;
    installments: number;
  };
  reference: string;
  redirect_url?: string;
}

export interface WompiTransactionResponse {
  data: {
    id: string;
    status: string;
    reference: string;
    created_at: string;
    finalized_at?: string;
    amount_in_cents: number;
    currency: string;
    customer_email: string;
    payment_method_type: string;
    payment_method: {
      type: string;
      extra?: any;
    };
    redirect_url?: string;
    checkout_url?: string;
    permalink?: string;
  };
}

export interface WompiWebhookEvent {
  event: string;
  data: {
    transaction: {
      id: string;
      status: string;
      reference: string;
      amount_in_cents: number;
      currency: string;
      payment_method?: {
        type: string;
        extra?: any;
      };
    };
  };
  signature: {
    checksum: string;
    properties: string[];
  };
}

@Injectable()
export class WompiService {
  private readonly logger = new Logger(WompiService.name);
  private readonly publicKey: string;
  private readonly privateKey: string;
  private readonly integritySecret: string;
  private readonly baseUrl: string;
  private readonly checkoutBaseUrl: string;

  constructor() {
    this.publicKey = process.env.WOMPI_PUBLIC_KEY || '';
    this.privateKey = process.env.WOMPI_PRIVATE_KEY || '';
    this.integritySecret = process.env.WOMPI_INTEGRITY_SECRET || '';
    this.baseUrl = process.env.WOMPI_BASE_URL || 'https://sandbox.wompi.co/v1';
    this.checkoutBaseUrl = 'https://checkout.wompi.co/p/';

    if (!this.privateKey) {
      this.logger.warn('Wompi credentials not configured. Payment features will not work.');
    }
  }

  /**
   * Genera la firma de integridad para Web Checkout/Widget (SHA256).
   * Fórmula: "<reference><amountInCents><currency><expirationTime?><integritySecret>"
   *
   * Fuente: docs de Wompi "Widget & Checkout Web".
   */
  generateIntegritySignature(params: {
    reference: string;
    amountInCents: number;
    currency: string;
    expirationTime?: string;
  }): string {
    if (!this.integritySecret) {
      throw new BadRequestException('Wompi integrity secret no está configurado (WOMPI_INTEGRITY_SECRET)');
    }

    const payload = `${params.reference}${params.amountInCents}${params.currency}${params.expirationTime ?? ''}${this.integritySecret}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Construye un link de pago para Web Checkout.
   * Nota: este link NO crea la transacción inmediatamente; Wompi crea la transacción cuando el usuario paga.
   */
  buildCheckoutLink(params: {
    amount: number;
    currency: string;
    customerEmail: string;
    reference: string;
    redirectUrl?: string;
    expirationTime?: string;
  }): string {
    if (!this.publicKey) {
      throw new BadRequestException('Wompi public key no está configurada (WOMPI_PUBLIC_KEY)');
    }

    const amountInCents = Math.round(params.amount * 100);
    const currency = params.currency === 'COP' ? 'COP' : params.currency;
    const integrity = this.generateIntegritySignature({
      reference: params.reference,
      amountInCents,
      currency,
      expirationTime: params.expirationTime,
    });

    const qs = new URLSearchParams();
    qs.set('public-key', this.publicKey);
    qs.set('currency', currency);
    qs.set('amount-in-cents', String(amountInCents));
    qs.set('reference', params.reference);
    qs.set('signature:integrity', integrity);

    // Opcionales (pre-fill)
    if (params.redirectUrl) qs.set('redirect-url', params.redirectUrl);
    if (params.expirationTime) qs.set('expiration-time', params.expirationTime);
    if (params.customerEmail) qs.set('customer-data:email', params.customerEmail);

    return `${this.checkoutBaseUrl}?${qs.toString()}`;
  }

  /**
   * Crea una transacción en Wompi
   */
  async createTransaction(
    amount: number,
    currency: string,
    customerEmail: string,
    reference: string,
    redirectUrl?: string,
  ): Promise<WompiTransactionResponse> {
    if (!this.privateKey) {
      throw new BadRequestException('Wompi no está configurado');
    }

    const requestBody: WompiTransactionRequest = {
      amount_in_cents: Math.round(amount * 100), // Convertir a centavos
      currency: currency === 'COP' ? 'COP' : 'USD', // Wompi principalmente soporta COP
      customer_email: customerEmail,
      payment_method: {
        // Si este método se usa, el caller debe proveer el type según la integración (CARD, PSE, NEQUI, etc).
        installments: 1,
      },
      reference,
      ...(redirectUrl && { redirect_url: redirectUrl }),
    };

    try {
      const response = await fetch(`${this.baseUrl}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.privateKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        this.logger.error('Error creating Wompi transaction:', error);
        throw new BadRequestException(`Error al crear transacción en Wompi: ${error.message || 'Unknown error'}`);
      }

      const data: WompiTransactionResponse = await response.json();
      return data;
    } catch (error: any) {
      this.logger.error('Exception creating Wompi transaction:', error);
      throw new BadRequestException(`Error al comunicarse con Wompi: ${error.message}`);
    }
  }

  /**
   * Obtiene el estado de una transacción
   */
  async getTransaction(transactionId: string): Promise<WompiTransactionResponse> {
    if (!this.privateKey) {
      throw new BadRequestException('Wompi no está configurado');
    }

    try {
      const response = await fetch(`${this.baseUrl}/transactions/${transactionId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.privateKey}`,
        },
      });

      if (!response.ok) {
        throw new BadRequestException('Error al obtener transacción de Wompi');
      }

      return await response.json();
    } catch (error: any) {
      this.logger.error('Exception getting Wompi transaction:', error);
      throw new BadRequestException(`Error al comunicarse con Wompi: ${error.message}`);
    }
  }

  /**
   * Valida la firma del webhook de Wompi
   */
  validateWebhookSignature(event: WompiWebhookEvent): boolean {
    if (!this.integritySecret) {
      this.logger.warn('Wompi integrity secret not configured. Skipping signature validation.');
      return true; // En desarrollo, permitir sin validación
    }

    const { signature, data } = event;
    const { checksum, properties } = signature;

    // Construir el string a verificar basado en las propiedades
    const valuesToSign = properties.map((prop) => {
      const keys = prop.split('.');
      let value: any = data;
      for (const key of keys) {
        value = value[key];
      }
      return value;
    });

    const stringToSign = valuesToSign.join('');
    const calculatedChecksum = crypto
      .createHmac('sha256', this.integritySecret)
      .update(stringToSign)
      .digest('hex');

    return calculatedChecksum === checksum;
  }

  /**
   * Genera una referencia única para la reserva
   */
  generateReference(bookingId: string): string {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `REF-${bookingId}-${random}`;
  }

  /**
   * Obtiene el link de pago de la respuesta de Wompi
   */
  getPaymentLink(transactionResponse: WompiTransactionResponse): string | null {
    const { data } = transactionResponse;
    return data.checkout_url || data.permalink || data.redirect_url || null;
  }
}
