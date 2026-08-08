// Copies the compiled ZK artifacts (managed compiler output) into the
// frontend's public directory so the browser can fetch them for proving.
//
//   contracts/managed/certificate/keys/<circuit>.prover   -> public/managed/certificate/keys/<circuit>.prover
//   contracts/managed/certificate/zkir/<circuit>.bzkir    -> public/managed/certificate/zkir/<circuit>.bzkir
//   contracts/managed/certificate/keys/<circuit>.verifier -> public/managed/certificate/<circuit>.vkey
//
// The FetchZkConfigProvider resolves artifacts as
//   <base>/<circuit>.vkey, <base>/keys/<circuit>.prover, <base>/zkir/<circuit>.bzkir.
// The compiled contract module is copied into frontend/src/generated so the
// browser bundle can import it like any local module.

import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(root, '..');
const source = join(repoRoot, 'contracts', 'managed', 'certificate');
const target = join(repoRoot, 'frontend', 'public', 'managed', 'certificate');
const contractTarget = join(repoRoot, 'frontend', 'src', 'generated', 'certificate-contract');

async function main() {
  const keys = await readdir(join(source, 'keys'));
  const zkir = await readdir(join(source, 'zkir'));

  await rm(target, { recursive: true, force: true });
  await mkdir(join(target, 'keys'), { recursive: true });
  await mkdir(join(target, 'zkir'), { recursive: true });

  let count = 0;
  for (const file of keys) {
    const from = join(source, 'keys', file);
    if (file.endsWith('.prover')) {
      await cp(from, join(target, 'keys', file));
      count++;
    } else if (file.endsWith('.verifier')) {
      await cp(from, join(target, `${file.replace(/\.verifier$/, '')}.vkey`));
      count++;
    }
  }
  for (const file of zkir) {
    if (file.endsWith('.bzkir')) {
      await cp(join(source, 'zkir', file), join(target, 'zkir', file));
      count++;
    }
  }

  await rm(contractTarget, { recursive: true, force: true });
  await mkdir(contractTarget, { recursive: true });
  await cp(join(source, 'contract', 'index.js'), join(contractTarget, 'index.js'));
  await cp(join(source, 'contract', 'index.d.ts'), join(contractTarget, 'index.d.ts'));
  count += 2;

  console.log(
    `Copied ${count} ZK artifacts + contract module (frontend/public/managed/certificate, frontend/src/generated/certificate-contract)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
