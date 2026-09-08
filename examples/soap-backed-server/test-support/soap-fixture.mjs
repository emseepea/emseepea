import { createServer } from "node:http";

export async function startSoapFixture(test) {
  let requests = 0;
  let lastRequest;
  const server = createServer(async (request, response) => {
    requests += 1;
    const body = await readBody(request);
    lastRequest = Object.freeze({
      body,
      method: request.method,
      path: request.url,
      soapAction: request.headers.soapaction,
    });
    const name = body.match(/<(?:\w+:)?name>([^<]+)<\/(?:\w+:)?name>/)?.[1] ?? "";
    if (name === "Redirect") {
      response.writeHead(302, { Location: "http://example.com/soap" });
      response.end();
      return;
    }
    if (name === "Trickle") {
      response.writeHead(200, { "Content-Type": "text/xml; charset=utf-8" });
      const body = successXml("Trickle", "snap", "60").body;
      let offset = 0;
      const chunkSize = Math.ceil(body.length / 10);
      const interval = setInterval(() => {
        if (offset < body.length) {
          response.write(body.slice(offset, offset + chunkSize));
          offset += chunkSize;
        }
        else {
          clearInterval(interval);
          response.end();
        }
      }, 200);
      response.once("close", () => clearInterval(interval));
      return;
    }
    if (name === "Timeout") await new Promise((resolve) => setTimeout(resolve, 2_500));
    const fixture = responseFor(name);
    response.writeHead(fixture.status, { "Content-Type": "text/xml; charset=utf-8" });
    response.end(fixture.body);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  test.after(() => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("SOAP fixture address unavailable");
  return {
    get lastRequest() { return lastRequest; },
    get requests() { return requests; },
    url: new URL(`http://127.0.0.1:${address.port}/soap`),
  };
}

function responseFor(name) {
  if (name === "Invalid XML") return { status: 200, body: "<soap:Envelope>" };
  if (name === "Invalid XSD") return successXml("Invalid XSD", "snap", "soon");
  if (name === "Zero Days") return successXml("Zero Days", "snap", "0");
  if (name === "Negative Days") return successXml("Negative Days", "snap", "-1");
  if (name === "Fractional Days") return successXml("Fractional Days", "snap", "1.5");
  if (name === "Valid Error Status") {
    return { ...successXml("Valid Error Status", "snap", "60"), status: 500 };
  }
  if (name === "Empty Type") return successXml("Empty Type", "", "60");
  if (name === "Long Type") return successXml("Long Type", "x".repeat(41), "60");
  if (name === "Too Many Traits") {
    return successXml("Too Many Traits", "snap", "60", undefined, ["1", "2", "3", "4", "5", "6"]);
  }
  if (name === "Missing Required Field") {
    return {
      status: 200,
      body: envelope(
        "<pea:GetPeaResponse><pea:name>Missing Required Field</pea:name>" +
        "<pea:peaType>snap</pea:peaType></pea:GetPeaResponse>",
      ),
    };
  }
  if (name === "Wrong Namespace") {
    return {
      status: 200,
      body: envelope(
        "<wrong:GetPeaResponse xmlns:wrong=\"urn:wrong\"><wrong:name>Wrong Namespace</wrong:name>" +
        "<wrong:peaType>snap</wrong:peaType><wrong:daysToMaturity>60</wrong:daysToMaturity>" +
        "</wrong:GetPeaResponse>",
      ),
    };
  }
  if (name === "DTD") return { status: 200, body: `<!DOCTYPE Envelope>${successXml("DTD", "snap", "60").body}` };
  if (name === "Entity") {
    return { status: 200, body: `<!DOCTYPE Envelope [<!ENTITY p "snap">]>${successXml("Entity", "&p;", "60").body}` };
  }
  if (name === "Too Deep") {
    return { status: 200, body: `<root>${"<node>".repeat(40)}value${"</node>".repeat(40)}</root>` };
  }
  if (name === "Too Many Nodes") {
    return { status: 200, body: `<root>${"<node/>".repeat(300)}</root>` };
  }
  if (name === "Too Many Attributes") {
    return {
      status: 200,
      body: envelope(`<pea:GetPeaResponse ${Array.from(
        { length: 33 },
        (_, index) => `a${index}="x"`,
      ).join(" ")}/>`),
    };
  }
  if (name === "Text Too Long") return successXml("Text Too Long", "snap", "60", "x".repeat(8_193));
  if (name === "Oversized") return successXml("Oversized", "snap", "60", "x".repeat(70_000));
  if (name === "SOAP Fault") {
    return {
      status: 500,
      body: envelope("<soap:Fault><faultcode>soap:Server</faultcode><faultstring>Private fixture detail</faultstring></soap:Fault>"),
    };
  }
  if (name === "Sugar Ann") {
    return successXml("Sugar Ann", "snap", "56", "Compact plants with edible pods.", ["bush", "early"]);
  }
  if (name === "Boundary Zero Traits") return successXml(name, "x", "1");
  if (name === "Boundary Five Traits") {
    return successXml(name, "x".repeat(40), "1", undefined, ["1", "2", "3", "4", "5"]);
  }
  return successXml(name || "Green Arrow", "shelling", "68", undefined, ["climbing"]);
}

function successXml(name, peaType, days, note, traits = []) {
  return {
    status: 200,
    body: envelope(
      `<pea:GetPeaResponse>` +
      `<pea:name>${escapeXml(name)}</pea:name>` +
      `<pea:peaType>${escapeXml(peaType)}</pea:peaType>` +
      `<pea:daysToMaturity>${escapeXml(days)}</pea:daysToMaturity>` +
      `${note === undefined ? "" : `<pea:note>${escapeXml(note)}</pea:note>`}` +
      traits.map((trait) => `<pea:trait>${escapeXml(trait)}</pea:trait>`).join("") +
      `</pea:GetPeaResponse>`,
    ),
  };
}

function envelope(content) {
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" ` +
    `xmlns:pea="urn:emseepea:pea-service"><soap:Body>${content}</soap:Body></soap:Envelope>`;
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}
