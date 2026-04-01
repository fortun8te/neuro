import { User } from './types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface LoginError {
  message: string;
}

export class LoginService {
  private users: Map<string, User> = new Map();

  constructor() {
    // Seed some test users
    this.users.set('test@example.com', {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin'
    });
  }

  async login(credentials: LoginCredentials): Promise<LoginResponse | LoginError> {
    // Validate input
    if (!credentials.email || !credentials.password) {
      return {
        message: 'Email and password are required'
      };
    }

    // Check if user exists
    const user = this.users.get(credentials.email.toLowerCase());
    if (!user) {
      return {
        message: 'Invalid email or password'
      };
    }

    // Validate password (simple hash check for demo)
    if (credentials.password !== 'password123') {
      return {
        message: 'Invalid email or password'
      };
    }

    // Generate a mock token
    const token = this.generateToken();

    return {
      user,
      token
    };
  }

  private generateToken(): string {
    return 'mock-token-' + Math.random().toString(36).substring(2, 15);
  }
}
