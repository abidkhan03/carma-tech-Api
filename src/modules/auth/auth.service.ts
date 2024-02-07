import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { Hash } from '@app/utils/hash.util';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '@modules/user/user.service';
import { User } from '@modules/user/user.entity';
import { SigninDto } from '@modules/auth/dto/signin.dto';
import { CognitoUserAttribute, CognitoUserPool } from 'amazon-cognito-identity-js';
import { RegisterRequestDto } from '@modules/auth/dto/register.dto';
import { fetchListUsers } from '@app/utils/helper.util';

@Injectable()
export class AuthService {
  private userPool: CognitoUserPool;
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UsersService,
  ) {
    this.userPool = new CognitoUserPool({
      UserPoolId: this.configService.get('USER_POOL_ID') || 'us-east-2_0Pitx53J7',
      ClientId: this.configService.get('COGNITO_USER_CLIENT_ID') || '5l1nf7orlu8lai7dpu83rs9551',
    });
  }

  async register(authRegisterRequest: RegisterRequestDto) {
    const { name, email, password } = authRegisterRequest;
    // check email is existed
    const existedUser = await fetchListUsers(email);
    if (existedUser.length > 0) throw new Error('The email is duplicated.');

    return new Promise((resolve, reject) => {
      return this.userPool.signUp(
        name,
        password,
        [new CognitoUserAttribute({ Name: 'email', Value: email })],
        null,
        (err, result) => {
          if (!result) {
            reject(err);
          } else {
            resolve(result.user);
          }
        },
      );
    });
  }

  async createToken(user: User) {
    return {
      expiresIn: this.configService.get('JWT_EXPIRATION_TIME'),
      accessToken: this.jwtService.sign({ id: user.id }),
      user,
    };
  }

  async validateUser(signinDto: SigninDto): Promise<any> {
    const user = await this.userService.getByEmail(signinDto.email);
    if (!user || !Hash.compare(signinDto.password, user.password)) {
      throw new UnauthorizedException('Invalid credentials!');
    }
    return user;
  }
}
