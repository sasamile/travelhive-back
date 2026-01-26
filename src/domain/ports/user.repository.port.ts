import { User } from '../entities/user.entity';

export interface IUserRepository {
  create(user: Partial<User>): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findByUserId(userId: string): Promise<User | null>;
  update(id: string, data: Partial<User>): Promise<User>;
  createAccount(userId: string, email: string, hashedPassword: string): Promise<void>;
  updatePassword(userId: string, hashedPassword: string): Promise<void>;
  hasAccount(userId: string): Promise<boolean>;
  getAccountPassword(userId: string): Promise<string | null>; // Obtener contraseña hasheada para verificación
}
