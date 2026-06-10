#!/usr/bin/env node
import { stopProcess } from './lib/process.mjs';

await stopProcess('lobby');
