import { IsString, IsNotEmpty, MinLength, IsOptional } from 'class-validator';

export class ChangePasswordDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  currentPassword?: string; // Opcional: solo requerido si el usuario ya tiene contraseña

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  newPassword: string;
}
