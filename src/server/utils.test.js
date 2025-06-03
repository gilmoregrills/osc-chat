const { generateNameFromIp, getAWSCredentialsDependingOnEnvironment } = require('./utils');

// No longer using global jest.mock for aws-sdk credential providers for these tests
// We will inject them directly.

describe('Server Utils', () => {
  describe('generateNameFromIp', () => {
    it('should generate a name for valid IP addresses', () => {
      expect(generateNameFromIp('192.168.1.1')).toEqual('myrtie');
      expect(generateNameFromIp('10.0.0.1')).toEqual('dorthy');
      expect(generateNameFromIp('172.16.0.1')).toEqual('ginelle');
    });

    it('should produce the same name for the same IP address', () => {
      const ip = '192.168.1.1';
      expect(generateNameFromIp(ip)).toEqual('myrtie');
    });

    it('should produce different names for different IP addresses', () => {
      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';
      expect(generateNameFromIp(ip1)).not.toEqual(generateNameFromIp(ip2));
    });
  });

  describe('getAWSCredentialsDependingOnEnvironment', () => {
    const originalEnv = { ...process.env };
    let mockFromInstanceMetadataProvider;
    let mockFromSSOProvider;
    let mockInnerInstanceFunc;
    let mockInnerSSOFunc;

    beforeEach(() => {
      jest.resetModules(); // Resets module cache
      process.env = { ...originalEnv }; // Reset env to original state

      mockInnerInstanceFunc = jest.fn();
      mockFromInstanceMetadataProvider = jest.fn(() => mockInnerInstanceFunc);

      mockInnerSSOFunc = jest.fn();
      mockFromSSOProvider = jest.fn(() => mockInnerSSOFunc);
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should use fromInstanceMetadataProvider in production', () => {
      process.env.NODE_ENV = 'production';
      // const { getAWSCredentialsDependingOnEnvironment } = require('./utils'); // Not strictly needed to re-require if utils doesn't cache env
      getAWSCredentialsDependingOnEnvironment({
        fromInstanceMetadataProvider: mockFromInstanceMetadataProvider
      });
      expect(mockFromInstanceMetadataProvider).toHaveBeenCalledTimes(1);
      expect(mockInnerInstanceFunc).toHaveBeenCalledTimes(1);
      expect(mockFromSSOProvider).not.toHaveBeenCalled();
    });

    it('should use fromSSOProvider in development', () => {
      process.env.NODE_ENV = 'development';
      getAWSCredentialsDependingOnEnvironment({
        fromSSOProvider: mockFromSSOProvider
      });
      expect(mockFromSSOProvider).toHaveBeenCalledWith({ profile: "osc-chat" });
      expect(mockInnerSSOFunc).toHaveBeenCalledTimes(1);
      expect(mockFromInstanceMetadataProvider).not.toHaveBeenCalled();
    });

     it('should use fromSSOProvider when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV; // Ensure NODE_ENV is not set
      getAWSCredentialsDependingOnEnvironment({
        fromSSOProvider: mockFromSSOProvider
      });
      expect(mockFromSSOProvider).toHaveBeenCalledWith({ profile: "osc-chat" });
      expect(mockInnerSSOFunc).toHaveBeenCalledTimes(1);
      expect(mockFromInstanceMetadataProvider).not.toHaveBeenCalled();
    });
  });
});
