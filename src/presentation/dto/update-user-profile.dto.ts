import { IsOptional, IsString, IsEmail, IsBoolean, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  nameUser?: string;

  @IsOptional()
  @IsEmail()
  emailUser?: string;

  @IsOptional()
  @IsString()
  dniUser?: string;

  @IsOptional()
  @IsString()
  phoneUser?: string;

  @IsOptional()
  @IsString()
  picture?: string;

  // Campos adicionales para customers/viajeros (opcionales)
  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferences?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  travelStyles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interestTags?: string[];
}
