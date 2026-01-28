import { IsEmail, IsString, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterHostDto {
  @IsString()
  @IsNotEmpty()
  nameUser: string; // Nombre completo

  @IsString()
  @IsNotEmpty()
  dniUser: string; // Documento de identidad

  @IsEmail()
  @IsNotEmpty()
  emailUser: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  phoneUser: string; // Teléfono

  @IsString()
  @IsNotEmpty()
  city: string; // Ciudad

  @IsString()
  @IsNotEmpty()
  department: string; // Departamento
}
