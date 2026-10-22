import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {AuthClient} from 'google-auth-library';
import {log,placeholder} from 'google-logging-utils';

export class GoogleEventTransportSetupError extends Error {
 constructor(readonly code:'INVALID_CONFIGURATION'|'UNSUPPORTED_DEPENDENCY_GRAPH'|'UNSAFE_SDK_LOGGING'){super(code);this.name='GoogleEventTransportSetupError';}
}
export function googleSdkGraphSafe():boolean {
 try {
  const here=createRequire(import.meta.url),auth=createRequire(here.resolve('google-auth-library'));
  const metadata=createRequire(auth.resolve('gcp-metadata'));
  const expected=realpathSync(here.resolve('google-logging-utils'));
  return expected===realpathSync(auth.resolve('google-logging-utils'))&&expected===realpathSync(metadata.resolve('google-logging-utils'));
 }catch{return false;}
}
export const googleSdkLoggingSafe=()=>!process.env.DEBUG_AUTH&&AuthClient.log===placeholder&&log('auth')===placeholder&&log('gcp-metadata')===placeholder;
export function assertGoogleSdkSafe():void {
 if(!googleSdkGraphSafe())throw new GoogleEventTransportSetupError('UNSUPPORTED_DEPENDENCY_GRAPH');
 if(!googleSdkLoggingSafe())throw new GoogleEventTransportSetupError('UNSAFE_SDK_LOGGING');
}
