const blocked=new Set(['google-auth-library','google-logging-utils']);
export async function resolve(specifier,context,nextResolve){
 if(blocked.has(specifier))throw new Error(`FORBIDDEN_OPTIONAL_PEER_IMPORT:${specifier}`);
 return nextResolve(specifier,context);
}
