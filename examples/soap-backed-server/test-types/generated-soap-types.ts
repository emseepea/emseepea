import type { GetPeaRequest, GetPeaResponse } from "../src/generated/pea-service.js";

const validRequest: GetPeaRequest = { name: "Sugar Ann" };

// @ts-expect-error The XSD requires the request name.
const missingRequestName: GetPeaRequest = {};

const validWithoutOptionalFields: GetPeaResponse = {
  name: "Sugar Ann",
  peaType: "snap",
  daysToMaturity: 56,
};

const validWithArray: GetPeaResponse = {
  ...validWithoutOptionalFields,
  trait: ["bush", "early"],
};

// @ts-expect-error The XSD requires daysToMaturity.
const missingRequiredField: GetPeaResponse = {
  name: "Sugar Ann",
  peaType: "snap",
};

const wrongNumericType: GetPeaResponse = {
  ...validWithoutOptionalFields,
  // @ts-expect-error The XSD declares daysToMaturity as numeric.
  daysToMaturity: "56",
};

const wrongArrayShape: GetPeaResponse = {
  ...validWithoutOptionalFields,
  // @ts-expect-error The XSD permits repeated trait elements, represented as an array.
  trait: "early",
};

void [
  validRequest,
  missingRequestName,
  validWithoutOptionalFields,
  validWithArray,
  missingRequiredField,
  wrongNumericType,
  wrongArrayShape,
];
