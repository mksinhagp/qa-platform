'use server';

import { invokeProc } from '@qa-platform/db';
import { requireOperator } from '@qa-platform/auth';

export interface Site {
  id: number;
  name: string;
  base_url: string;
  description: string | null;
  is_active: boolean;
  created_date: string;
  updated_date: string;
}

export interface SiteEnvironment {
  id: number;
  site_id: number;
  name: string;
  base_url: string;
  description: string | null;
  is_active: boolean;
  created_date: string;
  updated_date: string;
}

export interface SitesListResult {
  success: boolean;
  sites?: Site[];
  error?: string;
}

export interface SiteEnvironmentsListResult {
  success: boolean;
  environments?: SiteEnvironment[];
  error?: string;
}

export async function listSites(activeOnly?: boolean): Promise<SitesListResult> {
  try {
    await requireOperator();

    const result = await invokeProc('sp_sites_list', {
      i_is_active: activeOnly ?? null,
    });

    const sites: Site[] = result.map((row: {
      o_id: number;
      o_name: string;
      o_base_url: string;
      o_description: string | null;
      o_is_active: boolean;
      o_created_date: string;
      o_updated_date: string;
    }) => ({
      id: row.o_id,
      name: row.o_name,
      base_url: row.o_base_url,
      description: row.o_description,
      is_active: row.o_is_active,
      created_date: row.o_created_date,
      updated_date: row.o_updated_date,
    }));

    return { success: true, sites };
  } catch (error) {
    console.error('List sites error:', error);
    return { success: false, error: 'Failed to list sites' };
  }
}

export async function listSiteEnvironments(
  siteId?: number,
  activeOnly?: boolean
): Promise<SiteEnvironmentsListResult> {
  try {
    await requireOperator();

    const result = await invokeProc('sp_site_environments_list', {
      i_site_id: siteId ?? null,
      i_is_active: activeOnly ?? null,
    });

    const environments: SiteEnvironment[] = result.map((row: {
      o_id: number;
      o_site_id: number;
      o_name: string;
      o_base_url: string;
      o_description: string | null;
      o_is_active: boolean;
      o_created_date: string;
      o_updated_date: string;
    }) => ({
      id: row.o_id,
      site_id: row.o_site_id,
      name: row.o_name,
      base_url: row.o_base_url,
      description: row.o_description,
      is_active: row.o_is_active,
      created_date: row.o_created_date,
      updated_date: row.o_updated_date,
    }));

    return { success: true, environments };
  } catch (error) {
    console.error('List site environments error:', error);
    return { success: false, error: 'Failed to list site environments' };
  }
}
