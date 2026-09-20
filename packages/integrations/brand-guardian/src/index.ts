export interface ValidationConstraint {
  rule: string;
  level: 'strict' | 'loose';
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class BrandGuardian {
  constructor(private readonly constraints: ValidationConstraint[]) {}

  async validateImage(imageUrl: string): Promise<ValidationResult> {
    return {
      isValid: true,
      errors: [],
    };
  }
}
