import { Injectable, NotAcceptableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './user.entity';
import { SignupDto } from '@modules/auth/dto/signup.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) { }

  async get(id: number) {
    return this.userRepository.findOne({
      where: { id },
    });
  }

  async getByPhone(phone: string) {
    return await this.userRepository
      .createQueryBuilder('users')
      .where('users.phone = :phone')
      .setParameter('phone', phone)
      .getOne();
  }

  async getByEmail(email: string) {
    return await this.userRepository
      .createQueryBuilder('users')
      .where('users.email = :email')
      .setParameter('email', email)
      .getOne();
  }

  // async getByExternalId(externalId: string) {
  //   return await this.userRepository
  //     .createQueryBuilder('users')
  //     .where('users.external_identity_id = :externalId')
  //     .setParameter('externalId', externalId)
  //     .getOne();
  // }

  async create(signupDto: SignupDto) {
    const userByEmail = await this.getByEmail(signupDto.email);

    if (userByEmail) {
      throw new NotAcceptableException(
        'User with provided email already exists.',
      );
    }

    // Check if phone number already exists
    const userByPhone = await this.getByPhone(signupDto.phone);
    if (userByPhone) {
      throw new NotAcceptableException(
        'User with provided phone number already exists.',
      );
    }

    return await this.userRepository.save(
      this.userRepository.create(signupDto),
    );
  }

  async getUsersCount(): Promise<number> {
    return await this.userRepository.count();
  }
}
