// mammoth ships no types and has no @types package on npm. This covers only
// the one function this project calls (extractRawText) with the input shape
// it actually accepts — see node_modules/mammoth/lib/unzip.js.
declare module "mammoth" {
  export interface MammothMessage {
    type: string;
    message: string;
  }

  export interface MammothResult {
    value: string;
    messages: MammothMessage[];
  }

  export interface MammothInput {
    buffer?: Buffer;
    path?: string;
  }

  export function extractRawText(input: MammothInput): Promise<MammothResult>;
}
