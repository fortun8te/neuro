import { LoginService, LoginCredentials, LoginResponse, LoginError } from './loginService';

// Create a fresh instance for each test
const loginService = new LoginService();

describe('LoginService', () => {
  describe('login()', () => {
    it('should return valid login response with correct credentials', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await loginService.login(credentials);

      expect(response).toEqual({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'admin'
        },
        token: expect.any(String)
      });

      // Token should start with 'mock-token-'
      expect(response.token).toMatch(/^mock-token-/);
    });

    it('should reject login with missing email', async () => {
      const credentials: LoginCredentials = {
        email: '',
        password: 'password123'
      };

      const response = await loginService.login(credentials);

      expect(response).toEqual({
        message: 'Email and password are required'
      });
    });

    it('should reject login with missing password', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: ''
      };

      const response = await loginService.login(credentials);

      expect(response).toEqual({
        message: 'Email and password are required'
      });
    });

    it('should reject login with missing both fields', async () => {
      const credentials: LoginCredentials = {
        email: '',
        password: ''
      };

      const response = await loginService.login(credentials);

      expect(response).toEqual({
        message: 'Email and password are required'
      });
    });

    it('should reject login with invalid email', async () => {
      const credentials: LoginCredentials = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      const response = await loginService.login(credentials);

      expect(response).toEqual({
        message: 'Invalid email or password'
      });
    });

    it('should reject login with wrong password', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const response = await loginService.login(credentials);

      expect(response).toEqual({
        message: 'Invalid email or password'
      });
    });

    it('should handle case-insensitive email comparison', async () => {
      const credentials: LoginCredentials = {
        email: 'TEST@EXAMPLE.COM',
        password: 'password123'
      };

      const response = await loginService.login(credentials);

      expect(response).toEqual({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'admin'
        },
        token: expect.any(String)
      });
    });

    it('should generate different tokens on each call', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const response1 = await loginService.login(credentials);
      const response2 = await loginService.login(credentials);

      expect(response1.token).not.toEqual(response2.token);
    });

    it('should handle whitespace-only email', async () => {
      const credentials: LoginCredentials = {
        email: '   ',
        password: 'password123'
      };

      const response = await loginService.login(credentials);

      expect(response).toEqual({
        message: 'Email and password are required'
      });
    });

    it('should handle whitespace-only password', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: '   '
      };

      const response = await loginService.login(credentials);

      expect(response).toEqual({
        message: 'Email and password are required'
      });
    });
  });
});
