import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  baseURL: 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  advanced: {
    disableOriginCheck: true, // Desactiva la validación de Origin (útil para Postman y desarrollo)
    disableCSRFCheck: true, // Desactiva verificaciones CSRF (necesario cuando disableOriginCheck está activo)
  },
  user: {
    additionalFields: {
      dniUser: {
        type: 'string',
        required: false,
      },
      phoneUser: {
        type: 'string',
        required: false,
      },
      userId: {
        type: 'string',
        required: false,
      },
    },
  },
});
