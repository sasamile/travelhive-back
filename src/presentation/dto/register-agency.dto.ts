import { IsEmail, IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class RegisterAgencyDto {
  @IsEmail()
  @IsNotEmpty()
  emailUser: string;

  @IsString()
  @IsNotEmpty()
  nameUser: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  dniUser?: string;

  @IsString()
  @IsOptional()
  phoneUser?: string;

  @IsString()
  @IsOptional()
  pictureUser?: string;

  @IsString()
  @IsOptional()
  idCity?: string;

  @IsString()
  @IsNotEmpty()
  nameAgency: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  nit: string;

  @IsString()
  @IsNotEmpty()
  rntNumber: string;

  @IsString()
  @IsOptional()
  picture?: string;
}
