export type UploadResponse = {
    file_id: string
    filename: string
    pages?: number | null
  }
  
  export type SensitivityFinding = {
    type: string
    value: string
    page?: number | string | null
    start?: number | null
    end?: number | null
    severity: 'low' | 'medium' | 'high' | string
  }
  
  export type SensitivityReport = {
    is_sensitive: boolean
    summary: string
    findings: SensitivityFinding[]
  }
  
  export type Violation = {
    document: string
    page?: string | null
    section?: string | null
    regulation_citation: string
    value: string
    explanation: string
  }
  
  export type ComplianceReport = {
    compliance_score: number
    coverage_summary: string
    violations: Violation[]
    used_context: string[]
  }
  