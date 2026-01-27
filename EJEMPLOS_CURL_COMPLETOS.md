# Ejemplos de CURL Completos - Crear y Editar Viajes

## ⚠️ IMPORTANTE: Los endpoints usan `multipart/form-data` para las imágenes

Los endpoints de creación y actualización de viajes usan `multipart/form-data` porque aceptan archivos de imagen. Los campos JSON complejos (como `discountCodes`, `routePoints`, `itinerary`) deben enviarse como **strings JSON** dentro del form-data.

---

## 1. Crear Viaje con Códigos de Descuento y Promoter

```bash
curl -X POST http://localhost:3000/api/agencies/trips \
  -H "Cookie: better-auth.session_token=TU_TOKEN_AQUI" \
  -F "idCity=1" \
  -F "title=Aventura en Patagonia" \
  -F "description=Descubre la belleza de la Patagonia con esta increíble aventura" \
  -F "category=ADVENTURE" \
  -F "destinationRegion=Patagonia, Chile" \
  -F "latitude=-51.6226" \
  -F "longitude=-72.9880" \
  -F "startDate=2024-06-01T00:00:00.000Z" \
  -F "endDate=2024-06-15T00:00:00.000Z" \
  -F "durationDays=14" \
  -F "durationNights=13" \
  -F "price=2500" \
  -F "currency=USD" \
  -F "priceType=BOTH" \
  -F "maxPersons=12" \
  -F "status=PUBLISHED" \
  -F "isActive=true" \
  -F "coverImageIndex=0" \
  -F 'discountCodes=[{"code":"SUMMER2024","percentage":15,"maxUses":100,"perUserLimit":1},{"code":"EARLYBIRD","percentage":20,"maxUses":50,"perUserLimit":1}]' \
  -F "promoterCode=INFLUENCER123" \
  -F "promoterName=Juan Pérez" \
  -F 'routePoints=[{"name":"Punta Arenas","latitude":-53.1638,"longitude":-70.9171,"order":0},{"name":"Torres del Paine","latitude":-50.9423,"longitude":-73.4068,"order":1}]' \
  -F 'itinerary=[{"day":1,"title":"Llegada a Punta Arenas","subtitle":"Bienvenida y orientación","order":0,"activities":[{"type":"TRANSPORT","title":"Traslado desde aeropuerto","description":"Recogida en el aeropuerto","time":"14:00","order":0},{"type":"ACCOMMODATION","title":"Check-in hotel","description":"Hotel en el centro","time":"15:00","order":1}]}]' \
  -F "galleryImages=@/ruta/a/imagen1.jpg" \
  -F "galleryImages=@/ruta/a/imagen2.jpg"
```

### Versión sin imágenes (solo datos):

```bash
curl -X POST http://localhost:3000/api/agencies/trips \
  -H "Cookie: better-auth.session_token=TU_TOKEN_AQUI" \
  -F "idCity=1" \
  -F "title=Aventura en Patagonia" \
  -F "category=ADVENTURE" \
  -F "durationDays=14" \
  -F "durationNights=13" \
  -F "price=2500" \
  -F "currency=USD" \
  -F "status=DRAFT" \
  -F 'discountCodes=[{"code":"SUMMER2024","percentage":15,"maxUses":100}]' \
  -F "promoterCode=INFLUENCER123" \
  -F "promoterName=Juan Pérez"
```

---

## 2. Crear Viaje con Promoter Existente (sin crear uno nuevo)

```bash
curl -X POST http://localhost:3000/api/agencies/trips \
  -H "Cookie: better-auth.session_token=TU_TOKEN_AQUI" \
  -F "idCity=2" \
  -F "title=Tour por Kyoto" \
  -F "description=Descubre la cultura tradicional de Japón" \
  -F "category=CULTURAL" \
  -F "durationDays=5" \
  -F "durationNights=4" \
  -F "price=1800" \
  -F "currency=USD" \
  -F "priceType=BOTH" \
  -F "maxPersons=8" \
  -F "status=DRAFT" \
  -F 'discountCodes=[{"code":"KYOTO2024","percentage":12}]' \
  -F "promoterCode=INFLUENCER123"
```

---

## 3. Actualizar Viaje - Agregar Códigos de Descuento y Promoter

```bash
curl -X PATCH http://localhost:3000/api/agencies/trips/123456789 \
  -H "Cookie: better-auth.session_token=TU_TOKEN_AQUI" \
  -F "title=Aventura en Patagonia - Actualizado" \
  -F "description=Descripción actualizada del viaje" \
  -F 'discountCodes=[{"code":"WINTER2024","percentage":25,"maxUses":200,"perUserLimit":2},{"code":"LASTMINUTE","percentage":30,"maxUses":30}]' \
  -F "promoterCode=INFLUENCER456" \
  -F "promoterName=María González"
```

---

## 4. Actualizar Viaje - Solo Cambiar Promoter

```bash
curl -X PATCH http://localhost:3000/api/agencies/trips/123456789 \
  -H "Cookie: better-auth.session_token=TU_TOKEN_AQUI" \
  -F "promoterCode=INFLUENCER789" \
  -F "promoterName=Carlos Rodríguez"
```

---

## 5. Actualizar Viaje - Remover Promoter

```bash
curl -X PATCH http://localhost:3000/api/agencies/trips/123456789 \
  -H "Cookie: better-auth.session_token=TU_TOKEN_AQUI" \
  -F "promoterCode="
```

---

## 6. Actualizar Viaje - Eliminar Todos los Códigos de Descuento

```bash
curl -X PATCH http://localhost:3000/api/agencies/trips/123456789 \
  -H "Cookie: better-auth.session_token=TU_TOKEN_AQUI" \
  -F 'discountCodes=[]'
```

---

## 7. Actualizar Viaje Completo con Imágenes

```bash
curl -X PATCH http://localhost:3000/api/agencies/trips/123456789 \
  -H "Cookie: better-auth.session_token=TU_TOKEN_AQUI" \
  -F "title=Aventura en Patagonia - Edición Especial" \
  -F "description=Viaje actualizado con nuevas experiencias" \
  -F "category=ADVENTURE" \
  -F "price=2800" \
  -F "currency=USD" \
  -F "maxPersons=15" \
  -F "status=PUBLISHED" \
  -F "isActive=true" \
  -F "coverImageIndex=0" \
  -F 'discountCodes=[{"code":"NEWYEAR2024","percentage":18,"maxUses":150,"perUserLimit":1},{"code":"VIP2024","percentage":25,"maxUses":20}]' \
  -F "promoterCode=INFLUENCER999" \
  -F "promoterName=Ana Martínez" \
  -F 'routePoints=[{"name":"Nuevo punto","latitude":-53.1638,"longitude":-70.9171,"order":0}]' \
  -F 'galleryImages=[{"imageUrl":"https://example.com/existing-image.jpg","order":0}]' \
  -F "galleryImages=@/ruta/a/nueva-imagen.jpg"
```

---

## 8. Crear Viaje con Múltiples Imágenes y Datos Completos

```bash
curl -X POST http://localhost:3000/api/agencies/trips \
  -H "Cookie: better-auth.session_token=TU_TOKEN_AQUI" \
  -F "idCity=1" \
  -F "title=Viaje Completo a Islandia" \
  -F "description=Descubre los glaciares y auroras boreales" \
  -F "category=ADVENTURE" \
  -F "durationDays=10" \
  -F "durationNights=9" \
  -F "price=3500" \
  -F "currency=USD" \
  -F "priceType=BOTH" \
  -F "maxPersons=8" \
  -F "status=PUBLISHED" \
  -F "isActive=true" \
  -F "coverImageIndex=0" \
  -F 'discountCodes=[{"code":"ICELAND2024","percentage":20,"maxUses":50},{"code":"GROUP5","percentage":15,"maxUses":null}]' \
  -F "promoterCode=INFLUENCER_ISLANDIA" \
  -F "promoterName=Sofia Travel" \
  -F 'routePoints=[{"name":"Reykjavik","latitude":64.1466,"longitude":-21.9426,"order":0},{"name":"Golden Circle","latitude":64.2558,"longitude":-20.1205,"order":1}]' \
  -F 'itinerary=[{"day":1,"title":"Llegada","order":0,"activities":[{"type":"TRANSPORT","title":"Aeropuerto","order":0}]}]' \
  -F "galleryImages=@/ruta/a/imagen1.jpg" \
  -F "galleryImages=@/ruta/a/imagen2.jpg" \
  -F "galleryImages=@/ruta/a/imagen3.jpg"
```

---

---

## 9. Obtener Estadísticas Detalladas de un Viaje

Este endpoint te permite ver:
- Información del promoter asociado
- Estadísticas del mes actual vs mes anterior
- Códigos de descuento aplicados y cuántas veces se usaron
- Ganancias totales del viaje
- Historial completo de reservas con información de clientes

```bash
curl -X GET http://localhost:3000/api/agencies/trips/123456789/stats \
  -H "Cookie: better-auth.session_token=TU_TOKEN_AQUI"
```

### Respuesta de ejemplo:

```json
{
  "trip": {
    "idTrip": "123456789",
    "title": "Aventura en Patagonia",
    "status": "PUBLISHED",
    "isActive": true
  },
  "promoter": {
    "id": "987654321",
    "code": "INFLUENCER123",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "phone": "+573001234567",
    "referralCount": 15,
    "isActive": true
  },
  "monthlyStats": {
    "currentMonth": {
      "bookings": 12,
      "revenue": 30000,
      "currency": "USD",
      "averageBookingValue": 2500,
      "discountCodesUsed": 3,
      "totalDiscountAmount": 4500
    },
    "previousMonth": {
      "bookings": 8,
      "revenue": 20000,
      "currency": "USD",
      "averageBookingValue": 2500
    },
    "change": {
      "bookings": 50,
      "revenue": 50
    }
  },
  "discountCodes": [
    {
      "code": "SUMMER2024",
      "discountType": "PERCENTAGE",
      "value": 15,
      "timesUsed": 8,
      "totalDiscountAmount": 3600,
      "maxUses": 100,
      "usedCount": 8,
      "active": true
    }
  ],
  "totalStats": {
    "totalBookings": 45,
    "totalRevenue": 112500,
    "currency": "USD",
    "totalDiscountAmount": 16875,
    "averageBookingValue": 2500,
    "conversionRate": 85.5
  },
  "bookingHistory": [
    {
      "idBooking": "111222333",
      "status": "CONFIRMED",
      "dateBuy": "2024-01-15T10:30:00.000Z",
      "totalBuy": 2500,
      "subtotal": 3000,
      "discountAmount": 500,
      "discountCode": "SUMMER2024",
      "currency": "USD",
      "transactionId": "TXN123456",
      "customer": {
        "id": "user123",
        "name": "María García",
        "email": "maria@example.com",
        "phone": "+573001111111"
      },
      "expedition": {
        "idExpedition": "444555666",
        "startDate": "2024-06-01T00:00:00.000Z",
        "endDate": "2024-06-15T00:00:00.000Z"
      },
      "bookingItems": [
        {
          "itemType": "ADULT",
          "quantity": 2,
          "unitPrice": 1500,
          "totalPrice": 3000
        }
      ]
    }
  ]
}
```

---

## Notas Importantes:

1. **Formato**: Usa `-F` (form-data) en lugar de `-d` (JSON)
2. **Campos JSON**: Los arrays/objetos complejos como `discountCodes`, `routePoints`, `itinerary` deben enviarse como **strings JSON** con comillas simples alrededor
3. **Imágenes**: Usa `-F "galleryImages=@/ruta/a/archivo.jpg"` para cada imagen
4. **Autenticación**: Reemplaza `TU_TOKEN_AQUI` con tu token de sesión de Better Auth
5. **ID del Viaje**: En actualizaciones, reemplaza `123456789` con el ID real del viaje
6. **Estadísticas**: El endpoint `/agencies/trips/:tripId/stats` solo está disponible para usuarios con rol `admin` o `editor` de la agencia

## Ejemplo con JavaScript/Fetch (para referencia):

```javascript
const formData = new FormData();
formData.append('idCity', '1');
formData.append('title', 'Aventura en Patagonia');
formData.append('category', 'ADVENTURE');
formData.append('durationDays', '14');
formData.append('durationNights', '13');
formData.append('price', '2500');
formData.append('currency', 'USD');
formData.append('status', 'PUBLISHED');

// Códigos de descuento como JSON string
formData.append('discountCodes', JSON.stringify([
  { code: 'SUMMER2024', percentage: 15, maxUses: 100, perUserLimit: 1 },
  { code: 'EARLYBIRD', percentage: 20, maxUses: 50 }
]));

// Promoter
formData.append('promoterCode', 'INFLUENCER123');
formData.append('promoterName', 'Juan Pérez');

// Imágenes
formData.append('galleryImages', file1);
formData.append('galleryImages', file2);

fetch('http://localhost:3000/api/agencies/trips', {
  method: 'POST',
  headers: {
    'Cookie': 'better-auth.session_token=TU_TOKEN_AQUI'
  },
  body: formData
});
```
