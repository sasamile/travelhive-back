export class User {
  idUser: string;
  dniUser?: string;
  emailUser: string;
  nameUser: string;
  phoneUser?: string;
  userId: string;
  picture?: string; // Usa el campo image de Better Auth
  password: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Campos adicionales para customers/viajeros (opcionales)
  bio?: string;
  preferences?: string[]; // Array de preferencias (ej: ["Aventura", "Playa"])
  travelStyles?: string[]; // Array de estilos de viaje (ej: ["Aventura", "Lujo"])
  interestTags?: string[]; // Array de destinos de interés (ej: ["Islandia", "Japón"])

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}
