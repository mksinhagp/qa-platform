// Capability resolver backed by stored procedures
// Resolves capabilities for an operator based on role assignments

import { invokeProc } from '@qa-platform/db';

export interface ResolvedCapability {
  capabilityId: number;
  capabilityName: string;
  capabilityCategory: string;
}

/**
 * Get all capabilities for an operator
 * Resolves through role assignments to capabilities
 */
export async function getCapabilitiesForOperator(
  operatorId: number
): Promise<ResolvedCapability[]> {
  const result = await invokeProc('sp_capabilities_for_operator', {
    i_operator_id: operatorId,
  });

  return result.map((row: {
    o_capability_id: number;
    o_capability_name: string;
    o_capability_category: string;
  }) => ({
    capabilityId: row.o_capability_id,
    capabilityName: row.o_capability_name,
    capabilityCategory: row.o_capability_category,
  }));
}

/**
 * Check if an operator has a specific capability
 */
export async function hasCapability(
  operatorId: number,
  capabilityName: string
): Promise<boolean> {
  const capabilities = await getCapabilitiesForOperator(operatorId);
  return capabilities.some((c) => c.capabilityName === capabilityName);
}

/**
 * Check if an operator has any of the specified capabilities
 */
export async function hasAnyCapability(
  operatorId: number,
  capabilityNames: string[]
): Promise<boolean> {
  const capabilities = await getCapabilitiesForOperator(operatorId);
  const capabilitySet = new Set(capabilities.map((c) => c.capabilityName));
  return capabilityNames.some((name) => capabilitySet.has(name));
}

/**
 * Check if an operator has all of the specified capabilities
 */
export async function hasAllCapabilities(
  operatorId: number,
  capabilityNames: string[]
): Promise<boolean> {
  const capabilities = await getCapabilitiesForOperator(operatorId);
  const capabilitySet = new Set(capabilities.map((c) => c.capabilityName));
  return capabilityNames.every((name) => capabilitySet.has(name));
}
