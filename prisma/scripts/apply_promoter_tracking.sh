#!/bin/bash

# Script para aplicar los cambios de promoter tracking
# Este script ejecuta el SQL directamente en la base de datos

echo "🚀 Aplicando cambios de promoter tracking..."

# Cargar variables de entorno
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Verificar que DATABASE_URL esté definida
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL no está definida en .env"
    exit 1
fi

# Ejecutar el script SQL usando psql o el cliente de CockroachDB
if command -v psql &> /dev/null; then
    echo "📝 Ejecutando script SQL con psql..."
    psql "$DATABASE_URL" -f prisma/scripts/add_promoter_tracking.sql
elif command -v cockroach &> /dev/null; then
    echo "📝 Ejecutando script SQL con cockroach sql..."
    cockroach sql --url="$DATABASE_URL" -f prisma/scripts/add_promoter_tracking.sql
else
    echo "⚠️  No se encontró psql ni cockroach CLI"
    echo "📋 Por favor ejecuta manualmente el archivo: prisma/scripts/add_promoter_tracking.sql"
    echo "   en tu cliente de base de datos"
    exit 1
fi

if [ $? -eq 0 ]; then
    echo "✅ Cambios aplicados exitosamente"
    echo "🔄 Regenerando Prisma Client..."
    npx prisma generate
    echo "✅ ¡Listo! Puedes reiniciar el servidor"
else
    echo "❌ Error al aplicar los cambios"
    exit 1
fi
