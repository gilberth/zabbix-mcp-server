/**
 * Dashboard Utilities for Zabbix MCP Server
 * Contains helper functions and best practices for dashboard widget configuration
 */

/**
 * WIDGET CONFIGURATION BEST PRACTICES
 * 
 * Based on testing and troubleshooting, the following configuration patterns
 * have been proven to work correctly for svggraph widgets in Zabbix dashboards:
 */

export interface WidgetFieldConfig {
  name: string;
  type: number; // 0 = numeric, 1 = string
  value: string;
}

export interface SVGGraphWidgetConfig {
  name: string;
  type: 'svggraph';
  x: number;
  y: number;
  width: number;
  height: number;
  fields: WidgetFieldConfig[];
}

/**
 * CORRECT WIDGET FIELD STRUCTURE FOR SVGGRAPH WIDGETS
 * 
 * ✅ WORKING CONFIGURATION:
 * - Use ds.0.hosts.0 (NOT ds.hosts.0.0)
 * - Use ds.0.items.0 (NOT ds.items.0.0)
 * - Use ds.0.color_palette (NOT ds.color.0.0)
 * - For multiple datasets: ds.1.hosts.0, ds.1.items.0, ds.1.color_palette, etc.
 * - Do NOT use ds.host_patterns or ds.item_patterns
 * 
 * ❌ INCORRECT PATTERNS THAT CAUSE ERRORS:
 * - ds.hosts.0.0 → causes "Invalid parameter 'Data set 1/hosts': cannot be empty"
 * - ds.items.0.0 → causes similar errors
 * - ds.color.0.0 → doesn't work properly
 * - ds.host_patterns.0.0 → not needed and can cause issues
 * - ds.item_patterns.0.0 → not needed and can cause issues
 */

/**
 * Creates a properly configured svggraph widget field configuration
 * @param datasetIndex - Index of the dataset (0, 1, 2, etc.)
 * @param hostName - Name of the Zabbix host
 * @param itemName - Name of the Zabbix item
 * @param colorPalette - Color palette index (0, 1, 2, etc.)
 * @returns Array of widget fields for the dataset
 */
export function createSVGGraphDatasetFields(
  datasetIndex: number,
  hostName: string,
  itemName: string,
  colorPalette: number = 0
): WidgetFieldConfig[] {
  return [
    {
      name: `ds.${datasetIndex}.hosts.0`,
      type: 1,
      value: hostName
    },
    {
      name: `ds.${datasetIndex}.items.0`,
      type: 1,
      value: itemName
    },
    {
      name: `ds.${datasetIndex}.color_palette`,
      type: 0,
      value: colorPalette.toString()
    }
  ];
}

/**
 * Creates a complete svggraph widget configuration
 * @param name - Widget name
 * @param x - X position
 * @param y - Y position
 * @param width - Widget width
 * @param height - Widget height
 * @param datasets - Array of dataset configurations
 * @param reference - Optional reference code
 * @returns Complete widget configuration
 */
export function createSVGGraphWidget(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  datasets: Array<{
    hostName: string;
    itemName: string;
    colorPalette?: number;
  }>,
  reference?: string
): SVGGraphWidgetConfig {
  const fields: WidgetFieldConfig[] = [
    {
      name: 'righty',
      type: 0,
      value: '0'
    }
  ];

  // Add reference if provided
  if (reference) {
    fields.push({
      name: 'reference',
      type: 1,
      value: reference
    });
  }

  // Add dataset fields
  datasets.forEach((dataset, index) => {
    const datasetFields = createSVGGraphDatasetFields(
      index,
      dataset.hostName,
      dataset.itemName,
      dataset.colorPalette || index
    );
    fields.push(...datasetFields);
  });

  return {
    name,
    type: 'svggraph',
    x,
    y,
    width,
    height,
    fields
  };
}

/**
 * PROXMOX NODE MONITORING PATTERNS
 * 
 * Common item patterns for Proxmox node monitoring:
 * - CPU: "CPU utilization" or "Node [nodename]: CPU, usage"
 * - Memory: "Node [nodename]: Memory, used"
 * - Load Average: "Node [nodename]: CPU, loadavg"
 * - IO Wait: "Node [nodename]: CPU, iowait"
 */

export const PROXMOX_ITEM_PATTERNS = {
  CPU_UTILIZATION: 'CPU utilization',
  NODE_CPU_USAGE: (nodeName: string) => `Node [${nodeName}]: CPU, usage`,
  NODE_MEMORY_USED: (nodeName: string) => `Node [${nodeName}]: Memory, used`,
  NODE_LOAD_AVERAGE: (nodeName: string) => `Node [${nodeName}]: CPU, loadavg`,
  NODE_IO_WAIT: (nodeName: string) => `Node [${nodeName}]: CPU, iowait`,
} as const;

/**
 * Creates a standard Proxmox node monitoring dashboard layout
 * @param nodeName - Name of the Proxmox node
 * @param hostName - Zabbix host name (usually "proxmox")
 * @returns Array of widget configurations for a complete node dashboard
 */
export function createProxmoxNodeDashboard(
  nodeName: string,
  hostName: string = 'proxmox'
): SVGGraphWidgetConfig[] {
  return [
    // CPU Usage
    createSVGGraphWidget(
      `CPU Usage - Node [${nodeName}]`,
      0, 0, 12, 5,
      [{ hostName, itemName: PROXMOX_ITEM_PATTERNS.NODE_CPU_USAGE(nodeName) }],
      nodeName.toUpperCase().substring(0, 5)
    ),
    
    // Memory Usage
    createSVGGraphWidget(
      `Memory Used - Node [${nodeName}]`,
      12, 0, 12, 5,
      [{ hostName, itemName: PROXMOX_ITEM_PATTERNS.NODE_MEMORY_USED(nodeName) }],
      nodeName.toUpperCase().substring(0, 5)
    ),
    
    // Load Average
    createSVGGraphWidget(
      `Load Average - Node [${nodeName}]`,
      0, 5, 12, 5,
      [{ hostName, itemName: PROXMOX_ITEM_PATTERNS.NODE_LOAD_AVERAGE(nodeName) }],
      'LOAD'
    ),
    
    // IO Wait
    createSVGGraphWidget(
      `CPU IOWait - Node [${nodeName}]`,
      12, 5, 12, 5,
      [{ hostName, itemName: PROXMOX_ITEM_PATTERNS.NODE_IO_WAIT(nodeName) }],
      'IOWAIT'
    )
  ];
}

/**
 * Creates a dual-node comparison dashboard
 * @param node1Name - First node name
 * @param node2Name - Second node name
 * @param hostName - Zabbix host name (usually "proxmox")
 * @returns Array of widget configurations for dual-node comparison
 */
export function createProxmoxDualNodeDashboard(
  node1Name: string,
  node2Name: string,
  hostName: string = 'proxmox'
): SVGGraphWidgetConfig[] {
  return [
    // CPU Usage comparison
    createSVGGraphWidget(
      `CPU Usage - Nodes`,
      0, 0, 24, 5,
      [
        { hostName, itemName: PROXMOX_ITEM_PATTERNS.NODE_CPU_USAGE(node1Name), colorPalette: 0 },
        { hostName, itemName: PROXMOX_ITEM_PATTERNS.NODE_CPU_USAGE(node2Name), colorPalette: 1 }
      ],
      'CPU'
    ),
    
    // Memory Usage comparison
    createSVGGraphWidget(
      `Memory Used - Nodes`,
      0, 5, 24, 5,
      [
        { hostName, itemName: PROXMOX_ITEM_PATTERNS.NODE_MEMORY_USED(node1Name), colorPalette: 0 },
        { hostName, itemName: PROXMOX_ITEM_PATTERNS.NODE_MEMORY_USED(node2Name), colorPalette: 1 }
      ],
      'MEM'
    ),
    
    // Load Average comparison
    createSVGGraphWidget(
      `Load Average - Nodes`,
      0, 10, 12, 5,
      [
        { hostName, itemName: PROXMOX_ITEM_PATTERNS.NODE_LOAD_AVERAGE(node1Name), colorPalette: 0 },
        { hostName, itemName: PROXMOX_ITEM_PATTERNS.NODE_LOAD_AVERAGE(node2Name), colorPalette: 1 }
      ],
      'LOAD'
    ),
    
    // IO Wait comparison
    createSVGGraphWidget(
      `CPU IOWait - Nodes`,
      12, 10, 12, 5,
      [
        { hostName, itemName: PROXMOX_ITEM_PATTERNS.NODE_IO_WAIT(node1Name), colorPalette: 0 },
        { hostName, itemName: PROXMOX_ITEM_PATTERNS.NODE_IO_WAIT(node2Name), colorPalette: 1 }
      ],
      'IOWAIT'
    )
  ];
}

/**
 * ========================================================================
 * NUEVA LÓGICA DE CONFIGURACIÓN SVG - DESARROLLADA PARA RESOLVER ERRORES
 * ========================================================================
 * 
 * Esta sección contiene la lógica desarrollada para resolver los errores:
 * - "Invalid parameter 'Data set1/hosts': cannot be empty"
 * - "Invalid parameter 'Data set1/items': cannot be empty"
 * 
 * PROBLEMA IDENTIFICADO:
 * Los widgets SVG requieren configuración específica de host patterns e item patterns
 * además del itemid para funcionar correctamente.
 * 
 * SOLUCIÓN IMPLEMENTADA:
 * Configuración completa con itemids, host patterns, item patterns y parámetros visuales.
 */

export interface SVGWidgetFieldConfig {
  name: string;
  type: number; // 0 = integer, 1 = string, 4 = numeric
  value: string;
}

export interface SVGWidgetCompleteConfig {
  name: string;
  type: 'svggraph';
  x: number;
  y: number;
  width: number;
  height: number;
  view_mode: number;
  fields: SVGWidgetFieldConfig[];
}

/**
 * Crea la configuración completa para un widget SVG con todos los parámetros requeridos
 * Esta función implementa la lógica desarrollada para resolver errores de configuración
 * 
 * @param itemId - ID numérico del ítem de Zabbix
 * @param hostName - Nombre exacto del host en Zabbix
 * @param itemName - Nombre exacto del ítem en Zabbix
 * @param widgetName - Nombre del widget para el dashboard
 * @param color - Color hexadecimal para la línea (ej: "FF6B6B")
 * @param x - Posición X del widget
 * @param y - Posición Y del widget
 * @param width - Ancho del widget
 * @param height - Alto del widget
 * @returns Configuración completa del widget SVG
 */
export function createCompleteSVGWidget(
  itemId: string,
  hostName: string,
  itemName: string,
  widgetName: string,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number
): SVGWidgetCompleteConfig {
  return {
    name: widgetName,
    type: 'svggraph',
    x,
    y,
    width,
    height,
    view_mode: 0,
    fields: [
      // CRÍTICO: Item ID numérico - referencia principal del dato
      {
        name: 'ds.0.itemids.0',
        type: 4, // numeric type
        value: itemId
      },
      // CRÍTICO: Host pattern - nombre exacto del host
      {
        name: 'ds.0.hosts.0',
        type: 1, // string type
        value: hostName
      },
      // CRÍTICO: Item pattern - nombre exacto del ítem
      {
        name: 'ds.0.items.0',
        type: 1, // string type
        value: itemName
      },
      // Configuración visual - color de la línea
      {
        name: 'ds.0.color',
        type: 1, // string type
        value: color
      },
      // Configuración visual - tipo de línea (0 = línea sólida)
      {
        name: 'ds.0.type',
        type: 0, // integer type
        value: '0'
      },
      // Configuración visual - grosor de línea
      {
        name: 'ds.0.width',
        type: 0, // integer type
        value: '2'
      }
    ]
  };
}

/**
 * Configuraciones predefinidas para casos comunes de monitoreo
 */
export const SVG_WIDGET_PRESETS = {
  PROXMOX_CPU: {
    color: 'FF6B6B',
    itemPattern: 'CPU utilization',
    type: '0',
    width: '2'
  },
  PROXMOX_MEMORY: {
    color: '4ECDC4',
    itemPattern: 'Memory utilization',
    type: '0',
    width: '2'
  },
  PROXMOX_DISK: {
    color: '45B7D1',
    itemPattern: 'vda: Disk utilization',
    type: '0',
    width: '2'
  },
  SERVERHOME_CPU: {
    color: 'FF6B6B',
    itemPattern: 'CPU utilization',
    type: '0',
    width: '2'
  },
  SERVERHOME_MEMORY: {
    color: '4ECDC4',
    itemPattern: 'Memory utilization',
    type: '0',
    width: '2'
  },
  SERVERHOME_STORAGE: {
    color: '45B7D1',
    itemPattern: 'nvme0n1: Disk utilization',
    type: '0',
    width: '2'
  }
} as const;

/**
 * Valida que un widget SVG tenga todos los campos requeridos
 * @param widget - Configuración del widget a validar
 * @returns true si el widget está correctamente configurado
 */
export function validateSVGWidget(widget: SVGWidgetCompleteConfig): boolean {
  const requiredFields = [
    'ds.0.itemids.0',
    'ds.0.hosts.0',
    'ds.0.items.0'
  ];
  
  const presentFields = widget.fields.map(f => f.name);
  const missingFields = requiredFields.filter(field => !presentFields.includes(field));
  
  if (missingFields.length > 0) {
    console.error(`Campos faltantes en widget "${widget.name}": ${missingFields.join(', ')}`);
    return false;
  }
  
  return true;
}

/**
 * Crea un dashboard completo con widgets SVG correctamente configurados
 * Implementa la lógica desarrollada para Proxmox + ServerHome
 * 
 * @param proxmoxItems - Items de Proxmox con sus IDs
 * @param serverhomeItems - Items de ServerHome con sus IDs
 * @returns Configuración completa del dashboard
 */
export function createProxmoxServerhomeDashboard(
  proxmoxItems: {
    cpu: { id: string; host: string };
    memory: { id: string; host: string };
    disk: { id: string; host: string };
  },
  serverhomeItems: {
    cpu: { id: string; host: string };
    memory: { id: string; host: string };
    storage: { id: string; host: string };
  }
): SVGWidgetCompleteConfig[] {
  return [
    // Proxmox widgets
    createCompleteSVGWidget(
      proxmoxItems.cpu.id,
      proxmoxItems.cpu.host,
      SVG_WIDGET_PRESETS.PROXMOX_CPU.itemPattern,
      '📈 CPU Utilization - Proxmox',
      SVG_WIDGET_PRESETS.PROXMOX_CPU.color,
      0, 2, 12, 4
    ),
    createCompleteSVGWidget(
      proxmoxItems.memory.id,
      proxmoxItems.memory.host,
      SVG_WIDGET_PRESETS.PROXMOX_MEMORY.itemPattern,
      '📊 Memory Utilization - Proxmox',
      SVG_WIDGET_PRESETS.PROXMOX_MEMORY.color,
      12, 2, 12, 4
    ),
    createCompleteSVGWidget(
      proxmoxItems.disk.id,
      proxmoxItems.disk.host,
      SVG_WIDGET_PRESETS.PROXMOX_DISK.itemPattern,
      '💾 Disk Utilization - Proxmox',
      SVG_WIDGET_PRESETS.PROXMOX_DISK.color,
      0, 6, 12, 4
    ),
    
    // ServerHome widgets
    createCompleteSVGWidget(
      serverhomeItems.cpu.id,
      serverhomeItems.cpu.host,
      SVG_WIDGET_PRESETS.SERVERHOME_CPU.itemPattern,
      '🏠 CPU - ServerHome',
      SVG_WIDGET_PRESETS.SERVERHOME_CPU.color,
      0, 10, 8, 4
    ),
    createCompleteSVGWidget(
      serverhomeItems.memory.id,
      serverhomeItems.memory.host,
      SVG_WIDGET_PRESETS.SERVERHOME_MEMORY.itemPattern,
      '🏠 Memory - ServerHome',
      SVG_WIDGET_PRESETS.SERVERHOME_MEMORY.color,
      8, 10, 8, 4
    ),
    createCompleteSVGWidget(
      serverhomeItems.storage.id,
      serverhomeItems.storage.host,
      SVG_WIDGET_PRESETS.SERVERHOME_STORAGE.itemPattern,
      '🏠 Main Storage - ServerHome',
      SVG_WIDGET_PRESETS.SERVERHOME_STORAGE.color,
      16, 10, 8, 4
    )
  ];
}