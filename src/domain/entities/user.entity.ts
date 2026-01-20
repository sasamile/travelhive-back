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

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}
