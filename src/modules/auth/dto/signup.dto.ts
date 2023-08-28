import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, Matches, MinLength } from 'class-validator';
import { SameAs } from '@modules/common/validator/same-as.validator';

export class SignupDto {
  @ApiProperty({
    required: true,
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    required: true,
  })
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    required: true,
  })
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    required: true,
  })
  @IsNotEmpty()
  @MinLength(5)
  password: string;

  @ApiProperty({ required: true })
  @SameAs('password')
  passwordConfirmation: string;

  @ApiProperty()
  @IsOptional()
  @Matches(/^(\+|00)[1-9]\d{1,14}$/, { message: 'Phone number must be valid' })
  phone?: string;

  @ApiProperty()
  @IsOptional()
  external_identity_id?: string;
}
