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
   * 
   * IMPORTANTE: Construimos la URL manualmente porque URLSearchParams codifica los dos puntos (:)
   * y Wompi requiere que parámetros como 'signature:integrity' y 'customer-data:email' 
   * tengan los dos puntos sin codificar.
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

    // Construir parámetros manualmente para evitar codificación de los dos puntos en nombres de parámetros
    // Wompi requiere que 'signature:integrity' y 'customer-data:email' tengan los dos puntos sin codificar
    // NOTA: Si redirectUrl contiene localhost y causa problemas, se puede omitir (Wompi redirigirá a su página de éxito)
    const queryParams: string[] = [];
    
    // Parámetros requeridos (codificar valores pero NO los dos puntos en nombres)
    queryParams.push(`public-key=${encodeURIComponent(this.publicKey)}`);
    queryParams.push(`currency=${encodeURIComponent(currency)}`);
    queryParams.push(`amount-in-cents=${encodeURIComponent(String(amountInCents))}`);
    queryParams.push(`reference=${encodeURIComponent(params.reference)}`);
    // IMPORTANTE: Los dos puntos en 'signature:integrity' NO deben codificarse
    queryParams.push(`signature:integrity=${encodeURIComponent(integrity)}`);

    // Parámetros opcionales
    // En sandbox, Wompi debería permitir localhost. Si hay problemas, se puede deshabilitar con WOMPI_ALLOW_LOCALHOST_REDIRECT=false
    if (params.redirectUrl) {
      const isLocalhost = params.redirectUrl.includes('localhost') || params.redirectUrl.includes('127.0.0.1');
      const allowLocalhost = process.env.WOMPI_ALLOW_LOCALHOST_REDIRECT !== 'false'; // Por defecto: permitir localhost
      
      if (!isLocalhost || allowLocalhost) {
        queryParams.push(`redirect-url=${encodeURIComponent(params.redirectUrl)}`);
        this.logger.debug(`Redirect URL incluido en checkout: ${params.redirectUrl}`);
      } else {
        this.logger.warn(
          `Redirect URL con localhost omitido. Para habilitarlo, setea WOMPI_ALLOW_LOCALHOST_REDIRECT=true en .env o elimina la variable`,
        );
      }
    } else {
      this.logger.warn('No se proporcionó redirectUrl. El usuario deberá verificar el pago manualmente.');
    }
    
    if (params.expirationTime) {
      queryParams.push(`expiration-time=${encodeURIComponent(params.expirationTime)}`);
    }
    if (params.customerEmail) {
      // IMPORTANTE: Los dos puntos en 'customer-data:email' NO deben codificarse
      queryParams.push(`customer-data:email=${encodeURIComponent(params.customerEmail)}`);
    }

    return `${this.checkoutBaseUrl}?${queryParams.join('&')}`;
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
   * Obtiene el estado de una transacción por ID
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
   * Busca una transacción por referencia
   * Útil cuando el redirect no funciona y el usuario tiene la referencia de la página de Wompi
   */
  async getTransactionByReference(reference: string): Promise<WompiTransactionResponse | null> {
    if (!this.privateKey) {
      throw new BadRequestException('Wompi no está configurado');
    }

    try {
      // Wompi permite buscar transacciones por referencia usando query parameter
      const response = await fetch(`${this.baseUrl}/transactions?reference=${encodeURIComponent(reference)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.privateKey}`,
        },
      });

      if (!response.ok) {
        this.logger.warn(`No se encontró transacción con referencia: ${reference}`);
        return null;
      }

      const data = await response.json();
      
      // La respuesta puede ser un array o un objeto con data
      if (Array.isArray(data) && data.length > 0) {
        return { data: data[0] } as WompiTransactionResponse;
      } else if (data.data) {
        return data as WompiTransactionResponse;
      } else if (data.id) {
        return { data } as WompiTransactionResponse;
      }

      return null;
    } catch (error: any) {
      this.logger.error('Exception getting Wompi transaction by reference:', error);
      return null;
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
