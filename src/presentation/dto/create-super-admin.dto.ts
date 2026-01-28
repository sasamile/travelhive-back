import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';

export class CreateSuperAdminDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @MinLength(8)
  password: string;
}
