/**
 * Site record
 */
export interface Site {
  id: string;
  name: string;
  base_url: string;
  description?: string;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
}

/**
 * Site environment
 */
export interface SiteEnvironment {
  id: string;
  site_id: string;
  name: string;
  environment_type: "dev" | "staging" | "production";
  base_url: string;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
}
