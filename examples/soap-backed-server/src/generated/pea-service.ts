// Generated from the local SOAP XSD graph. Do not edit.
/** XSD simpleType: PeaType */
export type PeaType = string;

/** XSD complexType: SoapBody */
export interface SoapBody {
  GetPeaResponse: unknown;
  Fault: unknown;
}

/** XSD complexType: SoapEnvelope */
export interface SoapEnvelope {
  Body: SoapBody;
}

/** XSD complexType: PeaVariety */
export interface PeaVariety {
  name: string;
  peaType: PeaType;
  daysToMaturity: number;
  note?: string;
  trait?: string[];
}

/** XSD element: Envelope */
export type Envelope = SoapEnvelope;

/** XSD element: GetPeaRequest */
export interface GetPeaRequest {
  name: string;
}

/** XSD element: GetPeaResponse */
export type GetPeaResponse = PeaVariety;
