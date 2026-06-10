#!/usr/bin/env node
import { stopProcess } from './lib/process.mjs';
import { clientPidName } from './lib/dev-config.mjs';

const username = process.argv[2] ?? process.env.GRECKON_USERNAME ?? 'player';
await stopProcess(clientPidName(username));
await stopProcess('client');
