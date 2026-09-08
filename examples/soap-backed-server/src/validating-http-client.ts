import { request as requestHttp } from "node:http";
import { request as requestHttps } from "node:https";
import type { ClientRequest, IncomingMessage } from "node:http";
import type { IExOptions, IHeaders, IHttpClient } from "soap";
import { parseXml, validate, validateSubtree } from "xml-xsd-engine";
import type { SoapSchemaGraph } from "./soap-schema.js";

export const maximumSoapBytes = 65_536;

export class ValidatingHttpClient implements IHttpClient {
  readonly #endpoint: URL;
  readonly #schema: SoapSchemaGraph;
  #validation = Promise.resolve();

  constructor(endpoint: URL, schema: SoapSchemaGraph) {
    this.#endpoint = endpoint;
    this.#schema = schema;
  }

  request(
    requestUrl: string,
    data: unknown,
    callback: Parameters<IHttpClient["request"]>[2],
    headers: IHeaders = {},
    options: IExOptions = {},
  ): ReturnType<IHttpClient["request"]> {
    const body = Buffer.isBuffer(data) ? data : Buffer.from(String(data ?? ""));
    const pending = new Promise((resolve) => {
      let finished = false;
      let deadline: ReturnType<typeof setTimeout> | undefined;
      const fail = (error: Error, request?: ClientRequest) => {
        if (finished) return;
        finished = true;
        clearTimeout(deadline);
        request?.destroy();
        callback(error);
        resolve({});
      };
      const succeed = (result: object, responseBody: string) => {
        if (finished) return;
        finished = true;
        clearTimeout(deadline);
        callback(null, result, responseBody);
        resolve(result);
      };
      let target: URL;
      try {
        target = new URL(requestUrl);
        if (target.href !== this.#endpoint.href) throw new Error("Blocked SOAP destination");
        if (body.byteLength > maximumSoapBytes) throw new Error("SOAP request too large");
      } catch (error) {
        fail(error instanceof Error ? error : new Error("Invalid SOAP destination"));
        return;
      }
      const transport = target.protocol === "https:" ? requestHttps : requestHttp;
      const request = transport(target, {
        method: "POST",
        headers: Object.fromEntries(Object.entries(headers).map(([name, value]) => [name, String(value)])),
        signal: options.signal instanceof AbortSignal ? options.signal : undefined,
      }, (response) => this.#receive(response, body, succeed, fail, request));
      deadline = setTimeout(() => fail(new Error("SOAP request timed out"), request), 1_500);
      request.once("error", (error) => fail(error, request));
      request.end(body);
    });
    return pending as ReturnType<IHttpClient["request"]>;
  }

  #receive(
    response: IncomingMessage,
    requestBody: Buffer,
    succeed: (result: object, body: string) => void,
    fail: (error: Error, request?: ClientRequest) => void,
    request: ClientRequest,
  ) {
    const status = response.statusCode ?? 500;
    if (status < 200 || status >= 300) {
      fail(new Error(
        status >= 300 && status < 400 ? "SOAP redirects are blocked" : "SOAP request failed",
      ), request);
      return;
    }
    const chunks: Buffer[] = [];
    let bytes = 0;
    response.on("data", (chunk: Buffer) => {
      bytes += chunk.byteLength;
      if (bytes > maximumSoapBytes) fail(new Error("SOAP response too large"), request);
      else chunks.push(chunk);
    });
    response.once("error", (error) => fail(error, request));
    response.once("end", () => {
      if (bytes > maximumSoapBytes) return;
      const body = Buffer.concat(chunks).toString("utf8");
      const validation = this.#validation.then(() => this.#validate(body));
      this.#validation = validation.catch(() => {});
      void validation.then(() => {
        const result = {
          config: { data: requestBody, headers: {} },
          data: body,
          headers: response.headers,
          status: response.statusCode ?? 500,
          statusText: response.statusMessage ?? "",
        };
        succeed(result, body);
      }, (error: unknown) => fail(error instanceof Error ? error : new Error("Invalid SOAP response"), request));
    });
  }

  #validate(source: string) {
    if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("DTD and entity declarations are blocked");
    const document = parseXml(source, {
      expandDtdEntities: false,
      maxAttributes: 32,
      maxDepth: 32,
      maxNodeCount: 256,
      maxTextLength: 8_192,
    });
    if (!validate(document, this.#schema.envelope, { mode: "strict" }).valid) {
      throw new Error("SOAP response failed XSD validation");
    }
    const response = document.root?.getChild("Body")?.getChild("GetPeaResponse");
    if (!response || !validateSubtree(response, this.#schema.service, { mode: "strict" }).valid) {
      throw new Error("SOAP response failed XSD validation");
    }
  }
}
