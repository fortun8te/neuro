import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login } from '../src/login';

// Mock dependencies
vi.mock('../src/login', () => ({
  login: vi.fn()
}));

describe('login', () => {
  let mockApiCall: ReturnType<typeof vi.fn>;
  let mockDbUser: ReturnType<typeof vi.fn>;
  let mockTokenGen: ReturnType<typeof vi.fn>;
  let mockSessionStore: ReturnType<typeof vi.fn>;
  let mockLogger: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockApiCall = vi.fn();
    mockDbUser = vi.fn();
    mockTokenGen = vi.fn();
    mockSessionStore = vi.fn();
    mockLogger = vi.fn();

    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should return user data on successful login', async () => {
    const mockUser = {
      id: 'user123',
      username: 'johndoe',
      email: 'john@example.com',
      role: 'admin'
    };

    const mockResponse = {
      user: mockUser,
      token: 'mock-jwt-token-12345',
      expiresIn: 3600
    };

    mockApiCall.mockResolvedValue(mockResponse);
    mockDbUser.mockResolvedValue(mockUser);
    mockTokenGen.mockReturnValue('mock-jwt-token-12345');
    mockSessionStore.mockResolvedValue(true);
    mockLogger.info.mockImplementation(() => {});

    const mockDependencies = {
      api: { call: mockApiCall },
      db: { getUser: mockDbUser },
      token: { generate: mockTokenGen },
      session: { store: mockSessionStore },
      logger: mockLogger
    };

    const result = await login('johndoe', 'password123', mockDependencies);

    expect(result).toEqual(mockResponse);
    expect(mockApiCall).toHaveBeenCalledWith('johndoe', 'password123');
    expect(mockDbUser).toHaveBeenCalledWith('johndoe');
    expect(mockTokenGen).toHaveBeenCalledWith(mockUser, 'password123');
    expect(mockSessionStore).toHaveBeenCalledWith('user123', 'mock-jwt-token-12345');
    expect(mockLogger.info).toHaveBeenCalledWith('User logged in successfully');
  });

  it('should throw error when credentials are invalid', async () => {
    mockApiCall.mockRejectedValue(new Error('Invalid credentials'));
    mockDbUser.mockResolvedValue(null);
    mockTokenGen.mockImplementation(() => {});
    mockSessionStore.mockImplementation(() => {});
    mockLogger.error.mockImplementation(() => {});

    const mockDependencies = {
      api: { call: mockApiCall },
      db: { getUser: mockDbUser },
      token: { generate: mockTokenGen },
      session: { store: mockSessionStore },
      logger: mockLogger
    };

    await expect(
      login('johndoe', 'wrongpassword', mockDependencies)
    ).rejects.toThrow('Invalid credentials');

    expect(mockDbUser).toHaveBeenCalledWith('johndoe');
    expect(mockLogger.error).toHaveBeenCalledWith('Invalid credentials for user johndoe');
  });

  it('should throw error when user not found', async () => {
    mockApiCall.mockRejectedValue(new Error('User not found'));
    mockDbUser.mockResolvedValue(null);
    mockTokenGen.mockImplementation(() => {});
    mockSessionStore.mockImplementation(() => {});
    mockLogger.error.mockImplementation(() => {});

    const mockDependencies = {
      api: { call: mockApiCall },
      db: { getUser: mockDbUser },
      token: { generate: mockTokenGen },
      session: { store: mockSessionStore },
      logger: mockLogger
    };

    await expect(
      login('nonexistent', 'password123', mockDependencies)
    ).rejects.toThrow('User not found');

    expect(mockDbUser).toHaveBeenCalledWith('nonexistent');
    expect(mockLogger.error).toHaveBeenCalledWith('User not found: nonexistent');
  });

  it('should throw error when password is empty', async () => {
    mockApiCall.mockImplementation(() => {});
    mockDbUser.mockResolvedValue({ id: 'user123', username: 'johndoe' });
    mockTokenGen.mockImplementation(() => {});
    mockSessionStore.mockImplementation(() => {});
    mockLogger.error.mockImplementation(() => {});

    const mockDependencies = {
      api: { call: mockApiCall },
      db: { getUser: mockDbUser },
      token: { generate: mockTokenGen },
      session: { store: mockSessionStore },
      logger: mockLogger
    };

    await expect(
      login('johndoe', '', mockDependencies)
    ).rejects.toThrow('Password cannot be empty');
  });

  it('should throw error when username is empty', async () => {
    mockApiCall.mockImplementation(() => {});
    mockDbUser.mockResolvedValue(null);
    mockTokenGen.mockImplementation(() => {});
    mockSessionStore.mockImplementation(() => {});
    mockLogger.error.mockImplementation(() => {});

    const mockDependencies = {
      api: { call: mockApiCall },
      db: { getUser: mockDbUser },
      token: { generate: mockTokenGen },
      session: { store: mockSessionStore },
      logger: mockLogger
    };

    await expect(
      login('', 'password123', mockDependencies)
    ).rejects.toThrow('Username cannot be empty');
  });
});
