export interface Project {
  projectId: string;
  projectName: string;
  domains: string[];
  allowedDomains: string[];
  primaryColor: string;
  logoUrl: string;
  welcomeMessage: string;
  whatsappLink: string;
  ctaConfig: CTAConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface CTAConfig {
  bookCallUrl?: string;
  viewPricingUrl?: string;
  enrollNowUrl?: string;
  contactEmail?: string;
}
