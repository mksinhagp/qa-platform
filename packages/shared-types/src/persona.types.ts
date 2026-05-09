/**
 * Age band categories for personas
 */
export enum AgeBand {
  CHILD = "child",
  TEEN = "teen",
  ADULT = "adult",
  OLDER_ADULT = "older_adult",
  SENIOR = "senior",
}

/**
 * Device class categories
 */
export enum DeviceClass {
  DESKTOP = "desktop",
  LAPTOP = "laptop",
  TABLET = "tablet",
  MOBILE = "mobile",
  LOW_END_MOBILE = "low_end_mobile",
}

/**
 * Network profile categories
 */
export enum NetworkProfileType {
  FAST = "fast",
  NORMAL = "normal",
  SLOW_3G = "slow_3g",
  FLAKY = "flaky",
}

/**
 * Assistive technology types
 */
export enum AssistiveTech {
  NONE = "none",
  SCREEN_READER = "screen_reader",
  HIGH_CONTRAST = "high_contrast",
  ZOOM_400 = "zoom_400",
}

/**
 * Motor profile categories
 */
export enum MotorProfile {
  NORMAL = "normal",
  TREMOR = "tremor",
  SINGLE_HANDED = "single_handed",
}

/**
 * Language proficiency levels
 */
export enum LanguageProficiency {
  NATIVE = "native",
  SECOND_LANGUAGE = "second_language",
}

/**
 * Payment familiarity levels
 */
export enum PaymentFamiliarity {
  HIGH = "high",
  LOW = "low",
}

/**
 * Persona definition
 */
export interface Persona {
  id: string;
  display_name: string;
  age_band: AgeBand;
  device_class: DeviceClass;
  network_profile: NetworkProfileType;
  typing_wpm: number;
  typing_error_rate: number;
  reading_wpm: number;
  comprehension_grade_level: number;
  hesitation_ms_per_decision: number;
  retry_tolerance: number;
  distraction_probability: number;
  assistive_tech: AssistiveTech;
  motor_profile: MotorProfile;
  language_proficiency: LanguageProficiency;
  payment_familiarity: PaymentFamiliarity;
  abandons_on: string[];
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
}

/**
 * Device profile definition
 */
export interface DeviceProfile {
  id: string;
  name: string;
  device_class: DeviceClass;
  viewport_width: number;
  viewport_height: number;
  user_agent: string;
  is_mobile: boolean;
  device_pixel_ratio: number;
  touch_support: boolean;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
}

/**
 * Network profile definition
 */
export interface NetworkProfile {
  id: string;
  name: string;
  profile: NetworkProfileType;
  download_kbps: number;
  upload_kbps: number;
  latency_ms: number;
  packet_loss_percent: number;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
}
