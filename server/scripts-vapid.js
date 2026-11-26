// Run: node server/scripts-vapid.js   -> prints VAPID keys to paste in your hosting env vars
import * as wp from 'web-push';
const webpush = wp.default || wp;
const k = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${k.publicKey}\nVAPID_PRIVATE_KEY=${k.privateKey}`);
