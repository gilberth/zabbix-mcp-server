/**
 * Zabbix API Client for TypeScript
 * Provides a comprehensive interface to interact with Zabbix API
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ZabbixConfig, ZabbixApiResponse } from './types.js';

export class ZabbixClient {
  private client: AxiosInstance;
  private authToken: string | null = null;
  private requestId = 1;
  private config: ZabbixConfig;

  constructor(config: ZabbixConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.url,
      timeout: 30000,
    });
  }

  /**
   * Authenticate with Zabbix API with robust error handling
   */
  async login(): Promise<void> {
    console.error('[Zabbix] Starting authentication process...');
    
    // Step 1: Verify connectivity first
    const connectivity = await this.verifyConnectivity();
    if (!connectivity.connected) {
      throw new Error('Cannot connect to Zabbix API. Please verify the URL and network connectivity.');
    }
    
    console.error(`[Zabbix] Connected to Zabbix API version: ${connectivity.version}`);
    
    // Step 2: Handle token-based authentication
    if (this.config.token) {
      console.error('[Zabbix] Using API token authentication');
      this.authToken = this.config.token;
      
      // Verify token validity by making a test request
      try {
        await this.request('host.get', { limit: 1 });
        console.error('[Zabbix] Token authentication successful');
        return;
      } catch (error) {
        console.error('[Zabbix] Token authentication failed:', error);
        throw new Error('Invalid API token provided');
      }
    }

    // Step 3: Handle username/password authentication
    if (!this.config.user || !this.config.password) {
      throw new Error('Either token or user/password must be provided');
    }

    console.error(`[Zabbix] Attempting username/password authentication for user: ${this.config.user}`);
    
    try {
      const response = await this.request('user.login', {
        username: this.config.user,
        password: this.config.password,
      });

      this.authToken = response.result;
      console.error('[Zabbix] Username/password authentication successful');
      
      // Verify authentication by making a test request
      await this.request('host.get', { limit: 1 });
      console.error('[Zabbix] Authentication verification successful');
      
    } catch (error) {
      console.error('[Zabbix] Authentication failed:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Login name or password is incorrect')) {
          throw new Error('Invalid username or password');
        }
        if (error.message.includes('User is blocked')) {
          throw new Error('User account is blocked');
        }
        if (error.message.includes('GUI access disabled')) {
          throw new Error('GUI access is disabled for this user');
        }
      }
      
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Logout from Zabbix API
   */
  async logout(): Promise<void> {
    if (this.authToken && !this.config.token) {
      await this.request('user.logout', {});
    }
    this.authToken = null;
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.authToken;
  }

  /**
   * Verify Zabbix connectivity and API version
   */
  async verifyConnectivity(testAuth: boolean = false): Promise<{ 
    version: string; 
    connected: boolean; 
    authenticated?: boolean;
    auth_method?: string;
    error?: string;
  }> {
    try {
      // First, test basic connectivity with apiinfo.version (no auth required)
      const versionResponse = await this.request('apiinfo.version', {});
      const result = {
        version: versionResponse.result,
        connected: true
      };

      // If testAuth is requested and we have credentials, test authentication
      if (testAuth) {
        try {
          if (this.authToken) {
            // Test with existing token
            await this.request('user.get', { output: ['userid'] });
            return {
              ...result,
              authenticated: true,
              auth_method: 'existing_token'
            };
          } else {
            // Try to authenticate
            await this.login();
            return {
              ...result,
              authenticated: true,
              auth_method: 'username_password'
            };
          }
        } catch (authError) {
          const authErrorMessage = authError instanceof Error ? authError.message : String(authError);
          return {
            ...result,
            authenticated: false,
            error: `Authentication failed: ${authErrorMessage}`
          };
        }
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Zabbix connectivity check failed:', error);
      return {
        version: 'unknown',
        connected: false,
        error: `Connectivity failed: ${errorMessage}`
      };
    }
  }

  /**
   * Make a request to Zabbix API with robust authentication fallbacks
   */
  async request<T = any>(method: string, params: any = {}): Promise<ZabbixApiResponse<T>> {
    const payload: any = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.requestId++,
    };

    // Set up headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json-rpc',
    };

    // Authentication strategy based on best practices from guide
    let authAttempts = 0;
    const maxAuthAttempts = 2;

    while (authAttempts < maxAuthAttempts) {
      try {
        // Method 1: Authorization Bearer (recommended for Zabbix 7.4+)
        if (this.authToken && method !== 'user.login' && method !== 'apiinfo.version') {
          if (authAttempts === 0) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
            console.error(`[Zabbix] Using Bearer authentication for ${method}`);
          } else {
            // Method 2: Fallback with auth parameter (legacy compatibility)
            delete headers['Authorization'];
            payload.auth = this.authToken;
            console.error(`[Zabbix] Using legacy auth parameter for ${method}`);
          }
        }

        const response: AxiosResponse<ZabbixApiResponse<T>> = await this.client.post('/api_jsonrpc.php', payload, {
          headers
        });
        
        if (response.data.error) {
          const error = response.data.error;
          
          // Handle specific authentication errors with fallback
          if (error.code === -32602 && error.message.includes('auth') && authAttempts === 0) {
            console.warn(`[Zabbix] Bearer auth failed, trying legacy method: ${error.message}`);
            authAttempts++;
            continue;
          }
          
          // Handle "Not authorized" errors
          if (error.code === -32602 && error.message.includes('Not authorized')) {
            console.error(`[Zabbix] Authorization failed: ${error.message}`);
            throw new Error(`Zabbix API Authorization Error: ${error.message} (${error.code})`);
          }
          
          console.error(`[Zabbix] API Error: ${error.message} (${error.code})`);
          throw new Error(`Zabbix API Error: ${error.message} (${error.code})`);
        }

        console.error(`[Zabbix] Successfully executed ${method}`);
        return response.data;
        
      } catch (error) {
        if (authAttempts < maxAuthAttempts - 1 && 
            (error instanceof Error && error.message.includes('auth'))) {
          console.warn(`[Zabbix] Auth attempt ${authAttempts + 1} failed, trying fallback`);
          authAttempts++;
          continue;
        }
        
        if (axios.isAxiosError(error)) {
          console.error(`[Zabbix] HTTP Error: ${error.message}`);
          throw new Error(`HTTP Error: ${error.message}`);
        }
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Zabbix] Request failed: ${errorMessage}`);
        throw new Error(`Zabbix API request failed: ${errorMessage}`);
      }
    }

    throw new Error('All authentication methods failed');
  }

  // Host methods
  async hostGet(params: any = {}) {
    return this.request('host.get', params);
  }

  async hostCreate(params: any) {
    return this.request('host.create', params);
  }

  async hostUpdate(params: any) {
    return this.request('host.update', params);
  }

  async hostDelete(hostids: string[]) {
    return this.request('host.delete', hostids);
  }

  // Host Group methods
  async hostgroupGet(params: any = {}) {
    return this.request('hostgroup.get', params);
  }

  async hostgroupCreate(params: any) {
    return this.request('hostgroup.create', params);
  }

  async hostgroupUpdate(params: any) {
    return this.request('hostgroup.update', params);
  }

  async hostgroupDelete(groupids: string[]) {
    return this.request('hostgroup.delete', groupids);
  }

  // Item methods
  async itemGet(params: any = {}) {
    return this.request('item.get', params);
  }

  async itemCreate(params: any) {
    return this.request('item.create', params);
  }

  async itemUpdate(params: any) {
    return this.request('item.update', params);
  }

  async itemDelete(itemids: string[]) {
    return this.request('item.delete', itemids);
  }

  // Trigger methods
  async triggerGet(params: any = {}) {
    return this.request('trigger.get', params);
  }

  async triggerCreate(params: any) {
    return this.request('trigger.create', params);
  }

  async triggerUpdate(params: any) {
    return this.request('trigger.update', params);
  }

  async triggerDelete(triggerids: string[]) {
    return this.request('trigger.delete', triggerids);
  }

  // Template methods
  async templateGet(params: any = {}) {
    return this.request('template.get', params);
  }

  async templateCreate(params: any) {
    return this.request('template.create', params);
  }

  async templateUpdate(params: any) {
    return this.request('template.update', params);
  }

  async templateDelete(templateids: string[]) {
    return this.request('template.delete', templateids);
  }

  // Problem methods
  async problemGet(params: any = {}) {
    return this.request('problem.get', params);
  }

  // Event methods
  async eventGet(params: any = {}) {
    return this.request('event.get', params);
  }

  async eventAcknowledge(params: any) {
    return this.request('event.acknowledge', params);
  }

  // History methods
  async historyGet(params: any = {}) {
    return this.request('history.get', params);
  }

  // Trend methods
  async trendGet(params: any = {}) {
    return this.request('trend.get', params);
  }

  // Graph methods
  async graphGet(params: any = {}) {
    return this.request('graph.get', params);
  }

  // Discovery rule methods
  async discoveryruleGet(params: any = {}) {
    return this.request('discoveryrule.get', params);
  }

  // Item prototype methods
  async itemprototypeGet(params: any = {}) {
    return this.request('itemprototype.get', params);
  }

  // Configuration methods
  async configurationExport(params: any) {
    return this.request('configuration.export', params);
  }

  async configurationImport(params: any) {
    return this.request('configuration.import', params);
  }

  // User macro methods
  async usermacroGet(params: any = {}) {
    return this.request('usermacro.get', params);
  }

  // Dashboard methods
  async dashboardGet(params: any = {}) {
    return this.request('dashboard.get', params);
  }

  async dashboardCreate(params: any) {
    return this.request('dashboard.create', params);
  }

  async dashboardUpdate(params: any) {
    return this.request('dashboard.update', params);
  }

  async dashboardDelete(dashboardids: string[]) {
    return this.request('dashboard.delete', dashboardids);
  }

  // API info methods
  async apiinfoVersion() {
    // apiinfo.version requires empty params object
    return this.request('apiinfo.version', {});
  }
}