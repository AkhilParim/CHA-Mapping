import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import * as openpgp from 'openpgp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const name = process.env.PGP_NAME || 'CHA Facilitator Test';
  const email = process.env.PGP_EMAIL || 'test@example.com';
  const passphrase = process.env.PGP_PASSPHRASE || crypto.randomBytes(24).toString('base64');

  const { privateKey, publicKey } = await openpgp.generateKey({
    type: 'rsa',
    rsaBits: 2048,
    userIDs: [{ name, email }],
    passphrase
  });

  const projectRoot = path.resolve(__dirname, '..');
  const assetsPub = path.resolve(projectRoot, 'src/assets/facilitator.pub');
  const desktopPriv = path.resolve(process.env.HOME || process.env.USERPROFILE || __dirname, 'Desktop', 'facilitator-private.asc');

  fs.mkdirSync(path.dirname(assetsPub), { recursive: true });
  fs.writeFileSync(assetsPub, publicKey, 'utf8');
  fs.writeFileSync(desktopPriv, privateKey, 'utf8');

  console.log('Generated UID:', `${name} <${email}>`);
  console.log('Public key :', assetsPub);
  console.log('Private key:', desktopPriv);
  console.log('Passphrase :', passphrase);
}

main().catch((e) => {
  console.error('Error generating PGP keys:', e);
  process.exit(1);
});


