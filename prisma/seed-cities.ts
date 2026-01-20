// Cargar variables de entorno primero
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Verificar que DATABASE_URL esté disponible
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

// Crear el pool de conexiones de PostgreSQL
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Crear el adapter de Prisma para PostgreSQL/CockroachDB
const adapter = new PrismaPg(pool);

// Crear PrismaClient con el adapter (requerido para Prisma 7.x con CockroachDB)
const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

const colombianCities = [
  'Bogotá',
  'Medellín',
  'Cali',
  'Barranquilla',
  'Cartagena',
  'Bucaramanga',
  'Pereira',
  'Santa Marta',
  'Manizales',
  'Cúcuta',
  'Villavicencio',
  'Pasto',
  'Valledupar',
  'Montería',
  'Armenia',
  'Sincelejo',
  'Popayán',
  'Tunja',
  'Ibagué',
  'Riohacha',
  'Florencia',
  'Quibdó',
  'Neiva',
  'Yopal',
  'Mocoa',
  'Mitú',
  'Leticia',
  'Inírida',
  'San Andrés',
  'Arauca',
  'Turbo',
  'Apartadó',
  'Palmira',
  'Bello',
  'Soledad',
  'Envigado',
  'Soacha',
  'Itagüí',
  'Buenaventura',
  'Tuluá',
  'Dosquebradas',
  'Floridablanca',
  'Piedecuesta',
  'Girón',
  'La Estrella',
  'Copacabana',
  'Caucasia',
  'Magangué',
  'Maicao',
  'Barrancabermeja',
  'Tumaco',
  'Ipiales',
  'Ocaña',
  'El Carmen de Viboral',
  'Facatativá',
  'Chía',
  'Zipaquirá',
  'Mosquera',
  'Madrid',
  'Funza',
  'Girardot',
  'Fusagasugá',
  'Sogamoso',
  'Duitama',
  'Jamundí',
  'Yumbo',
];

async function main() {
  console.log('Iniciando seed de ciudades...');

  // Obtener ciudades existentes para evitar duplicados
  const existingCities = await prisma.city.findMany({
    select: { nameCity: true },
  });

  const existingNames = new Set(
    existingCities.map((city) => city.nameCity.toLowerCase()),
  );

  // Filtrar ciudades que no existen
  const citiesToInsert = colombianCities.filter(
    (city) => !existingNames.has(city.toLowerCase()),
  );

  if (citiesToInsert.length === 0) {
    console.log('Todas las ciudades ya existen en la base de datos.');
    return;
  }

  // Insertar ciudades en lotes
  const batchSize = 50;
  for (let i = 0; i < citiesToInsert.length; i += batchSize) {
    const batch = citiesToInsert.slice(i, i + batchSize);
    await prisma.city.createMany({
      data: batch.map((city) => ({
        nameCity: city,
      })),
      skipDuplicates: true,
    });
    console.log(`Insertadas ${Math.min(i + batchSize, citiesToInsert.length)} de ${citiesToInsert.length} ciudades...`);
  }

  console.log(`✅ Seed completado. ${citiesToInsert.length} ciudades insertadas.`);
}

main()
  .catch((e) => {
    console.error('Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
