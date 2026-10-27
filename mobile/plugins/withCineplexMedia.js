'use strict';
const {withAndroidManifest,withDangerousMod}=require('expo/config-plugins');
const fs=require('node:fs');
const path=require('node:path');

/**
 * Android-only HTTP support for the approved upstream servers used by the
 * previously working native v1.1 app. No global cleartext exception.
 */
module.exports=function withCineplexMedia(config){
  config=withAndroidManifest(config,config=>{
    const app=config.modResults.manifest.application?.[0];
    if(!app)throw new Error('Android application manifest missing');
    app.$['android:networkSecurityConfig']='@xml/pinflix_network_security';
    return config;
  });
  return withDangerousMod(config,['android',async config=>{
    const dir=path.join(config.modRequest.platformProjectRoot,'app','src','main','res','xml');
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'pinflix_network_security.xml'),
      '<?xml version="1.0" encoding="utf-8"?>\n'+
      '<network-security-config>\n'+
      '  <base-config cleartextTrafficPermitted="false"/>\n'+
      '  <domain-config cleartextTrafficPermitted="true">\n'+
      '    <domain includeSubdomains="false">cineplexbd.net</domain>\n'+
      '    <domain includeSubdomains="false">vod.cineplexbd.net</domain>\n'+
      '    <domain includeSubdomains="false">103.136.200.124</domain>\n'+
      '  </domain-config>\n'+
      '</network-security-config>\n');
    return config;
  }]);
};
