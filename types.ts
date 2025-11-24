export enum ConstructionSystem {
  TRADITIONAL = 'Mampostería (Ladrillos)',
  SIP = 'Paneles SIP',
  STEEL_FRAME = 'Steel Frame',
  WOOD_FRAME = 'Wood Frame',
  METAL_PANEL = 'Paneles Termoaislantes Metálicos',
}

export interface UserInputs {
  plateArea: number; // m2
  wallHeight: number; // m
  wallPerimeter: number; // m
  windowArea: number; // m2
  doorCount: number; // units
}

export interface MaterialItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number; // ARS
  category: 'Platea' | 'Muros' | 'Aberturas' | 'Techo';
}

export interface CalculationResult {
  materials: MaterialItem[];
  totalCost: number;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface SupplierResult {
  text: string;
  sources: { title: string; uri: string }[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}