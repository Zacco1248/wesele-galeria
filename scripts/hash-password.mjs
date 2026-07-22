#!/usr/bin/env node
/**
 * Generate a bcrypt hash for the admin password.
 *
 *   npm run hash-password -- "moje-tajne-haslo"
 *   npm run hash-password            (prompts interactively)
 *
 * Paste the printed hash into ADMIN_PASSWORD_HASH in your .env.
 */
import bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const ROUNDS = 12;

async function getPassword() {
	const arg = process.argv[2];
	if (arg) return arg;
	const rl = createInterface({ input: stdin, output: stdout });
	const pw = await rl.question('Nowe hasło administratora: ');
	rl.close();
	return pw;
}

const password = (await getPassword()).trim();
if (password.length < 6) {
	console.error('Hasło musi mieć co najmniej 6 znaków.');
	process.exit(1);
}

const hash = await bcrypt.hash(password, ROUNDS);
console.log('\nDodaj do .env:\n');
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
console.log('\n(Wygeneruj też sekret sesji, np.:)');
console.log(`ADMIN_SESSION_SECRET=${(await import('node:crypto')).randomBytes(32).toString('hex')}`);
