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
   * Authenticate with Zabbix API
   */
  async login(): Promise<void> {
    if (this.config.token) {
      // Use API token authentication - store token for per-request usage
      this.authToken = this.config.token;
      return;
    }

    if (!this.config.user || !this.config.password) {
      throw new Error('Either token or user/password must be provided');
    }

    const response = await this.request('user.login', {
      username: this.config.user,
      password: this.config.password,
    });

    this.authToken = response.result;
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
   * Make a request to Zabbix API
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
      'Content-Type': 'application/json',
    };

    // Add Authorization header for authenticated requests (Zabbix 7.4+ style)
    if (this.authToken && method !== 'user.login' && method !== 'apiinfo.version') {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    try {
      const response: AxiosResponse<ZabbixApiResponse<T>> = await this.client.post('/api_jsonrpc.php', payload, {
        headers
      });
      
      if (response.data.error) {
        throw new Error(`Zabbix API Error: ${response.data.error.message} (${response.data.error.code})`);
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`HTTP Error: ${error.message}`);
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Zabbix API request failed: ${errorMessage}`);
    }
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