'use strict';
const {withAndroidManifest,withAppBuildGradle,withMainApplication,withDangerousMod}=require('expo/config-plugins');
const fs=require('node:fs');
const path=require('node:path');

/**
 * Android uses the unchanged original Java provider for every catalogue
 * and media request. No PinFlix/Vercel API is needed by the APK.
 */
module.exports=function withPinFlixDirectSource(config){
 config=withAndroidManifest(config,conf=>{
  const app=conf.modResults.manifest.application?.[0];
  if(!app)throw Error('Missing Android application element');
  app.$['android:networkSecurityConfig']='@xml/pinflix_network_security';
  delete app.$['android:usesCleartextTraffic'];
  return conf;
 });
 config=withAppBuildGradle(config,conf=>{
  if(!conf.modResults.contents.includes('org.jsoup:jsoup:')){
   const next=conf.modResults.contents.replace(/dependencies\s*\{/,'dependencies {\n    implementation("org.jsoup:jsoup:1.18.3")');
   if(next===conf.modResults.contents)throw Error('Cannot locate Android dependencies block');
   conf.modResults.contents=next;
  }
  return conf;
 });
 config=withMainApplication(config,conf=>{
  const original=conf.modResults.contents;
  if(!original.includes('PinFlixDirectPackage')){
   if(!original.includes('import com.facebook.react.PackageList'))throw Error('Unexpected MainApplication: no PackageList import');
   let next=original.replace('import com.facebook.react.PackageList',
     'import com.facebook.react.PackageList\nimport com.pincodeit.pinflix.source.PinFlixDirectPackage');
   next=next.replace(/PackageList\(this\)\.packages\.apply\s*\{/,
     'PackageList(this).packages.apply {\n            add(PinFlixDirectPackage())');
   if(next===original||!next.includes('add(PinFlixDirectPackage())'))throw Error('Cannot attach native media module');
   conf.modResults.contents=next;
  }
  return conf;
 });
 return withDangerousMod(config,['android',async conf=>{
  const project=conf.modRequest.platformProjectRoot;
  const xml=path.join(project,'app','src','main','res','xml');
  fs.mkdirSync(xml,{recursive:true});
  fs.writeFileSync(path.join(xml,'pinflix_network_security.xml'),[
    '<?xml version="1.0" encoding="utf-8"?>',
    '<network-security-config>',
    '  <base-config cleartextTrafficPermitted="false"/>',
    '  <domain-config cleartextTrafficPermitted="true">',
    '    <domain includeSubdomains="false">cineplexbd.net</domain>',
    '    <domain includeSubdomains="false">vod.cineplexbd.net</domain>',
    '    <domain includeSubdomains="false">103.136.200.124</domain>',
    '    <domain includeSubdomains="false">cds3.cineplexbd.net</domain>',
    '  </domain-config>',
    '</network-security-config>',
    ''
  ].join('\n'));
  const src=path.join(project,'app','src','main','java','com','pincodeit','pinflix','source');
  fs.mkdirSync(src,{recursive:true});
  for(const filename of ['ProviderClient.java','PinFlixDirectModule.java','PinFlixDirectPackage.java']){
   const from=path.join(conf.modRequest.projectRoot,'native',filename);
   if(!fs.existsSync(from))throw Error('Missing native source: '+filename);
   fs.copyFileSync(from,path.join(src,filename));
  }
  return conf;
 }]);
};
