import { ConstructionSystem, UserInputs, MaterialItem } from '../types';

export const calculateMaterials = (
  inputs: UserInputs,
  system: ConstructionSystem,
  currentPrices: Record<string, number>
): MaterialItem[] => {
  const materials: MaterialItem[] = [];
  const { plateArea, wallHeight, wallPerimeter, windowArea, doorCount } = inputs;
  
  // Helper to add material
  const addMat = (id: string, name: string, unit: string, qty: number, cat: MaterialItem['category'], defaultPrice: number) => {
    // Round quantities to reasonable construction decimals
    const finalQty = Math.ceil(qty * 100) / 100;
    materials.push({
      id,
      name,
      unit,
      quantity: finalQty,
      unitPrice: currentPrices[id] || defaultPrice,
      category: cat
    });
  };

  // --- A. PLATEA (Common) ---
  // Concrete H17 (assuming 12cm avg thickness for generic plate) - Updated Price ~180k
  addMat('conc_h17', 'Hormigón H17 Elaborado', 'm³', plateArea * 0.12, 'Platea', 180000);
  // Mesh (Malla cima) - assuming 10% overlap - Updated Price
  addMat('mesh_steel', 'Malla Acero Simag (15x15) 5.5mm', 'm²', plateArea * 1.10, 'Platea', 8500);
  // Polyethylene Film - 200 microns - Updated Price
  addMat('poly_film', 'Film Polietileno 200 micrones', 'm²', plateArea * 1.10, 'Platea', 1200);

  // --- B. MUROS (System Specific) ---
  const grossWallArea = wallPerimeter * wallHeight;
  const netWallArea = Math.max(0, grossWallArea - windowArea - (doorCount * 2)); // Approx door area 2m2

  switch (system) {
    case ConstructionSystem.TRADITIONAL:
      // Ladrillos Huecos 18x18x33 (approx 15 units/m2)
      addMat('brick_hollow', 'Ladrillo Hueco 18x18x33', 'unidades', netWallArea * 15.5, 'Muros', 950);
      // Mortero de Asiento (Cement/Sand/Lime) - simplified to m3 equivalent
      addMat('mortar_mix', 'Mortero Asiento (Premezcla)', 'kg', netWallArea * 25, 'Muros', 350);
      // Revoque (Grueso + Fino)
      addMat('plaster_mix', 'Revoque Listo (Interior/Ext)', 'kg', netWallArea * 35, 'Muros', 450);
      // Estructura Techo: Metálica (Perfil C)
      addMat('roof_struct_metal', 'Perfil C Galv. 100x50x15x2mm', 'ml', plateArea * 1.5, 'Techo', 10500);
      break;

    case ConstructionSystem.SIP:
      // Panels 1.22 x 2.44 = ~2.97 m2. Use Height to determine utilization.
      // Simply: Net Area / 2.97 * waste factor
      addMat('sip_panel', 'Panel SIP 122x244cm (Espesor std)', 'unidades', (netWallArea / 2.97) * 1.1, 'Muros', 120000);
      addMat('sip_screws', 'Tornillos SIP (Caja)', 'unidades', (netWallArea * 10), 'Muros', 250);
      // OSB Exterior already part of SIP often, but prompt asks for "OSB exterior 9.5mm" as part of SIP req?
      addMat('osb_95', 'Placa OSB 9.5mm (Exterior)', 'm²', netWallArea * 1.05, 'Muros', 9500);
      // Estructura Techo: Madera
      addMat('roof_struct_wood', 'Tirantes Madera 2"x6" (Estructura Techo)', 'ml', plateArea * 1.5, 'Techo', 7500);
      break;

    case ConstructionSystem.STEEL_FRAME:
      // PGC 100mm (Montantes) - Every 40cm
      // CORRECCIÓN: Standard PGC es 100 x 40 (o 45) x 12 (labio)
      const montantesCount = Math.ceil(wallPerimeter / 0.40);
      const montantesLength = montantesCount * wallHeight;
      addMat('pgc_100', 'Perfil PGC 100x40x0.9mm (Montantes)', 'ml', montantesLength * 1.05, 'Muros', 8500);
      
      // PGU 100mm (Soleras) - Piso + Techo + Lintels approx
      // CORRECCIÓN: Standard PGU es 100 x 35
      const solerasLength = (wallPerimeter * 2) + (windowArea * 2); 
      addMat('pgu_100', 'Perfil PGU 100x35x0.9mm (Soleras)', 'ml', solerasLength * 1.05, 'Muros', 7200);
      
      // OSB 9.5mm Rigidizing
      addMat('osb_95', 'Placa OSB 9.5mm (Rigidización)', 'm²', netWallArea * 1.05, 'Muros', 9500);
      
      // Insulation (Glass wool)
      addMat('insul_wall', 'Lana de Vidrio (Muro)', 'm²', netWallArea * 1.05, 'Muros', 6500);
      
      // Tornillos T1
      addMat('screw_t1', 'Tornillos T1 Punta Mecha', 'unidades', netWallArea * 30, 'Muros', 45);
      
      // Estructura Techo: Metálica
      // Standard structural C profile with lip
      addMat('roof_struct_metal', 'Perfil C Galv. 100x50x15x2mm', 'ml', plateArea * 1.5, 'Techo', 10500);
      break;

    case ConstructionSystem.WOOD_FRAME:
      // Wood 2x4 structure
      const studsCount = Math.ceil(wallPerimeter / 0.40);
      const studsLength = studsCount * wallHeight;
      addMat('wood_2x4', 'Tirante Pino 2"x4" (Estructura)', 'ml', (studsLength + (wallPerimeter * 2)) * 1.1, 'Muros', 4500);
      
      // Machimbre exterior 3/4 (19mm)
      addMat('siding_wood', 'Machimbre 3/4" (19mm) Exterior', 'm²', netWallArea * 1.1, 'Muros', 8500);
      
      // Insulation
      addMat('insul_wall', 'Lana de Vidrio (Muro)', 'm²', netWallArea * 1.05, 'Muros', 6500);
      
      // Estructura Techo: Madera
      addMat('roof_struct_wood', 'Tirantes Madera 2"x6" (Estructura Techo)', 'ml', plateArea * 1.5, 'Techo', 7500);
      break;

    case ConstructionSystem.METAL_PANEL:
      // Sandwich Panels
      addMat('metal_panel_wall', 'Panel Sándwich Poliuretano (Muro)', 'm²', netWallArea * 1.05, 'Muros', 65000);
      
      // Structural Tubes
      // Columns (100x100) approx every 3m
      const cols = Math.ceil(wallPerimeter / 3);
      addMat('tube_100x100', 'Tubo Estructural 100x100x2.0mm', 'ml', cols * wallHeight, 'Muros', 18000);
      
      // Beams/Support (100x50)
      addMat('tube_100x50', 'Tubo Estructural 100x50x2.0mm', 'ml', wallPerimeter * 2, 'Muros', 12000);
      
      addMat('screw_panel', 'Tornillos para Panel', 'unidades', netWallArea * 8, 'Muros', 250);
      
      // Estructura Techo: Metálica
      addMat('roof_struct_metal', 'Perfil C Galv. 100x50x15x2mm', 'ml', plateArea * 1.5, 'Techo', 10500);
      break;
  }

  // --- C. ABERTURAS ---
  addMat('win_dvh', 'Ventanas DVH (Aluminio/PVC)', 'm²', windowArea, 'Aberturas', 250000);
  addMat('door_ext', 'Puerta Exterior Seguridad', 'unidades', doorCount, 'Aberturas', 350000);

  // --- D. TECHO (Common requirements logic) ---
  // Cubierta Chapa N25
  addMat('roof_sheet', 'Chapa Sinusoidal Galv. N°25', 'm²', plateArea * 1.15, 'Techo', 22000);
  // Aislación Techo
  addMat('insul_roof', 'Aislante Térmico (Espuma+Alum)', 'm²', plateArea * 1.15, 'Techo', 6500);
  // Tornillos Techo
  addMat('screw_roof', 'Tornillo Autoperforante Chapa (con arandela)', 'unidades', plateArea * 6, 'Techo', 120);

  return materials;
};