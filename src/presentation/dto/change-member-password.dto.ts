import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangeMemberPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}
