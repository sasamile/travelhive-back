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

async function applyHostFields() {
  try {
    console.log('🔄 Aplicando campos city y department a la tabla user...');

    // Ejecutar el SQL directamente
    console.log('➕ Agregando columna city...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "user" 
      ADD COLUMN IF NOT EXISTS city STRING;
    `);
    console.log('✅ Columna city agregada');

    console.log('➕ Agregando columna department...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "user" 
      ADD COLUMN IF NOT EXISTS department STRING;
    `);
    console.log('✅ Columna department agregada');

    console.log('➕ Agregando columna is_host...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "user" 
      ADD COLUMN IF NOT EXISTS is_host BOOL NOT NULL DEFAULT false;
    `);
    console.log('✅ Columna is_host agregada');

    console.log('🔄 Regenerando Prisma Client...');
    const { execSync } = require('child_process');
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Prisma Client regenerado');

    console.log('✅ Migración completada exitosamente');
  } catch (error) {
    console.error('❌ Error aplicando migración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyHostFields()
  .then(() => {
    console.log('✨ Proceso finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
