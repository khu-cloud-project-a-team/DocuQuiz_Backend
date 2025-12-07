import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  
  // Generate a 10-character alphanumeric token.
   
  private generateToken(length = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  
   // Create a new user with a unique token.
   
  async signup(displayName?: string): Promise<{ userId: string; token: string }> {
    // Ensure uniqueness by retrying on collision (rare with 10-char space).
    let token: string;
    let exists = true;
    do {
      token = this.generateToken();
      const found = await this.userRepository.findOne({ where: { token } });
      exists = !!found;
    } while (exists);

    const user = this.userRepository.create({ token, displayName });
    const saved = await this.userRepository.save(user);

    return { userId: saved.id, token: saved.token };
  }

   // Validate token and return user if exists.
  async validateToken(token: string): Promise<User | null> {
    if (!token) return null;
    return this.userRepository.findOne({ where: { token } });
  }
}
