'use strict';
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
async function main(){
 const root=path.resolve(__dirname,'..');
 const svg=fs.readFileSync(path.join(root,'assets/icon.svg'));
 const out=path.join(root,'assets/icon.png');
 await sharp(svg).resize(1024,1024).png({compressionLevel:9}).toFile(out);
 console.log('Generated PinFlix app icon:',out);
}
main().catch(error=>{console.error(error);process.exit(1);});
