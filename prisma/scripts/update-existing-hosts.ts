import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function updateExistingHosts() {
  try {
    console.log('🔄 Actualizando usuarios existentes que son anfitriones...');

    // Actualizar usuarios que tienen city y department pero is_host es false
    const result = await prisma.$executeRawUnsafe(`
      UPDATE "user" 
      SET is_host = true 
      WHERE city IS NOT NULL 
        AND department IS NOT NULL 
        AND (is_host IS NULL OR is_host = false);
    `);

    console.log(`✅ ${result} usuario(s) actualizado(s) como anfitrión(es)`);

    // Verificar cuántos anfitriones hay ahora
    const hostsCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      SELECT COUNT(*) as count 
      FROM "user" 
      WHERE is_host = true;
    `);

    console.log(`📊 Total de anfitriones: ${hostsCount[0]?.count || 0}`);
  } catch (error) {
    console.error('❌ Error actualizando usuarios:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateExistingHosts()
  .then(() => {
    console.log('✨ Proceso finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
