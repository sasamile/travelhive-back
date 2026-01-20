import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { PrismaClient } from '@prisma/client';

// Función para crear la instancia de auth desde PrismaService de NestJS
export const createAuthInstance = (prisma: PrismaClient) => {
  return betterAuth({
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    emailAndPassword: {
      enabled: true,
    },
    baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
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
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // Verificar que el usuario tenga una agencia aprobada antes de iniciar sesión
        if (ctx.path === '/sign-in/email' || ctx.path === '/sign-up/email') {
          if (ctx.path === '/sign-in/email' && ctx.body?.email) {
            // Verificar si el usuario tiene agencias aprobadas
            const user = await prisma.user.findUnique({
              where: { email: ctx.body.email },
              include: {
                agencyMembers: {
                  include: {
                    agency: true,
                  },
                },
              },
            });

            if (user && user.agencyMembers.length > 0) {
              // Verificar si tiene al menos una agencia aprobada
              const hasApprovedAgency = user.agencyMembers.some(
                (member) => member.agency.approvalStatus === 'APPROVED'
              );

              if (!hasApprovedAgency) {
                // Verificar si todas están pendientes o rechazadas
                const hasPending = user.agencyMembers.some(
                  (member) => member.agency.approvalStatus === 'PENDING'
                );
                const hasRejected = user.agencyMembers.some(
                  (member) => member.agency.approvalStatus === 'REJECTED'
                );

                if (hasPending) {
                  throw new APIError('FORBIDDEN', {
                    message: 'Tu agencia está pendiente de aprobación. Por favor espera la revisión de un administrador.',
                  });
                }

                if (hasRejected) {
                  const rejectedAgency = user.agencyMembers.find(
                    (member) => member.agency.approvalStatus === 'REJECTED'
                  );
                  throw new APIError('FORBIDDEN', {
                    message: `Tu agencia fue rechazada.${rejectedAgency?.agency.rejectionReason ? ` Razón: ${rejectedAgency.agency.rejectionReason}` : ''}`,
                  });
                }
              }
            }
          }
        }
      }),
    },
  });
};
