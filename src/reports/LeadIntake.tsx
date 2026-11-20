// Lead capture is not part of the public build. Forms in the demo send nothing.
export interface LeadFields {
    [key: string]: string | undefined
}
export function registerLeadKey(_key?: string, _opts: { allForms?: boolean } = {}) {}
export async function sendLead(_input: LeadFields, _form: string, _keyOverride?: string): Promise<{ sent: boolean; status?: number }> {
    return { sent: false }
}
