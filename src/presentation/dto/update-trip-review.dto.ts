import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

export class UpdateTripReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number; // Calificación de 1 a 5 estrellas

  @IsOptional()
  @IsString()
  comment?: string; // Comentario opcional
}
