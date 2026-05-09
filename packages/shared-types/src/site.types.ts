/**
 * Site record
 */
export interface Site {
  id: number;
  name: string;
  base_url: string;
  description?: string;
  is_active: boolean;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
}

/**
 * Site environment
 */
export interface SiteEnvironment {
  id: number;
  site_id: number;
  name: string;
  base_url: string;
  description?: string;
  is_active: boolean;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
}
