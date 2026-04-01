import { LoginService, LoginCredentials, LoginResponse, LoginError } from './src/loginService';

// Mock the LoginService constructor to allow testing
jest.mock('./src/loginService', () => {
  const { LoginService } = jest.requireActual('./src/loginService');
  return {
    ...LoginService,
    new: jest.fn(() => new LoginService())
  };
});

// Global setup for tests
beforeEach(() => {
  // Clear any mock state
  jest.clearAllMocks();
});