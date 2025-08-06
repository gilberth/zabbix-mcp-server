/**
 * Type definitions for Zabbix MCP Server
 */

export interface ZabbixConfig {
  url: string;
  token?: string;
  user?: string;
  password?: string;
  readOnly?: boolean;
  debug?: boolean;
}

export interface ZabbixHost {
  hostid?: string;
  host: string;
  name?: string;
  status?: number;
  groups: Array<{ groupid: string }>;
  interfaces: ZabbixInterface[];
  templates?: Array<{ templateid: string }>;
  inventory_mode?: number;
}

export interface ZabbixInterface {
  type: number;
  main: number;
  useip: number;
  ip?: string;
  dns?: string;
  port: string;
  details?: Record<string, any>;
}

export interface ZabbixHostGroup {
  groupid?: string;
  name: string;
}

export interface ZabbixItem {
  itemid?: string;
  name: string;
  key_: string;
  hostid: string;
  type: number;
  value_type: number;
  delay: string;
  units?: string;
  description?: string;
  status?: number;
}

export interface ZabbixTrigger {
  triggerid?: string;
  description: string;
  expression: string;
  priority: number;
  status: number;
  comments?: string;
}

export interface ZabbixTemplate {
  templateid?: string;
  host: string;
  name?: string;
  description?: string;
  groups: Array<{ groupid: string }>;
}

export interface ZabbixProblem {
  eventid: string;
  objectid: string;
  name: string;
  severity: number;
  clock: string;
  acknowledged: number;
  suppressed: number;
}

export interface ZabbixEvent {
  eventid: string;
  source: number;
  object: number;
  objectid: string;
  acknowledged: number;
  clock: string;
  ns: string;
  name: string;
  severity: number;
}

export interface ZabbixHistory {
  itemid: string;
  clock: string;
  value: string;
  ns: string;
}

export interface ZabbixGraph {
  graphid?: string;
  name: string;
  width: number;
  height: number;
  yaxismin: number;
  yaxismax: number;
  gitems: ZabbixGraphItem[];
}

export interface ZabbixGraphItem {
  gitemid?: string;
  graphid?: string;
  itemid: string;
  color: string;
  sortorder: number;
  calc_fnc: number;
  type: number;
}

export interface ZabbixDiscoveryRule {
  itemid?: string;
  name: string;
  key_: string;
  hostid: string;
  type: number;
  delay: string;
  status?: number;
}

export interface ZabbixItemPrototype {
  itemid?: string;
  name: string;
  key_: string;
  hostid: string;
  ruleid: string;
  type: number;
  value_type: number;
  delay: string;
}

export interface ZabbixUserMacro {
  globalmacroid?: string;
  macro: string;
  value: string;
  description?: string;
}

export interface ZabbixApiResponse<T = any> {
  jsonrpc: string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data: string;
  };
  id: number;
}

export interface SearchFilter {
  [key: string]: string | number | boolean;
}

export interface FilterCriteria {
  [key: string]: any;
}

export interface GetParams {
  output?: string | string[];
  search?: SearchFilter;
  filter?: FilterCriteria;
  limit?: number;
  sortfield?: string | string[];
  sortorder?: string;
  countOutput?: boolean;
  selectGroups?: string | string[];
  selectHosts?: string | string[];
  selectItems?: string | string[];
  selectTriggers?: string | string[];
  selectGraphs?: string | string[];
  selectTemplates?: string | string[];
  selectParentTemplates?: string | string[];
  selectMacros?: string | string[];
  selectDiscoveryRule?: string | string[];
  selectItemPrototypes?: string | string[];
  selectTriggerPrototypes?: string | string[];
  selectGraphPrototypes?: string | string[];
  selectHostPrototypes?: string | string[];
}